import { NextResponse } from "next/server";

import { extrahiereAngebot } from "@/lib/ai/extract-angebot";
import { extraktionKosten, transkriptionKosten } from "@/lib/ai/kosten";
import {
  AUDIO_MAX_BYTES,
  AUDIO_MAX_SEKUNDEN,
  transkribiere,
} from "@/lib/ai/transcribe";
import { darfAngebotErstellen } from "@/lib/abo";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { PreislisteEintrag } from "@/types/database";

/**
 * =============================================================================
 * Sprachnachricht → fertiger Angebotsentwurf
 * =============================================================================
 * Der eine Endpunkt, um den es im ganzen Produkt geht. Ablauf:
 *
 *   1. Session prüfen
 *   2. Kontingent prüfen  ← VOR dem ersten Cent KI-Kosten
 *   3. Audio → Text (Whisper) oder direkt eingetippten Text übernehmen
 *   4. Preisliste laden
 *   5. Text + Preisliste → Positionen (Claude, siehe extract-angebot.ts)
 *   6. Angebot und Positionen speichern
 *   7. Verbrauch protokollieren
 *
 * Bewusst KEIN Speichern der Audiodatei: die Aufnahme enthält Namen, Anschriften
 * und Gesprächsfetzen von Dritten. Wir brauchen sie nach der Transkription nicht
 * mehr, also heben wir sie auch nicht auf — Datensparsamkeit ist hier billiger
 * als jede Löschroutine. Das Transkript bleibt, damit der Handwerker
 * nachvollziehen kann, woraus die KI die Positionen gebaut hat.
 */

// Der Node-Runtime braucht es wegen der SDKs; die Extraktion dauert je nach
// Länge des Diktats bis zu einer Minute.
export const runtime = "nodejs";
export const maxDuration = 120;

interface Antwort {
  angebotId?: string;
  fehler?: string;
}

export async function POST(request: Request): Promise<NextResponse<Antwort>> {
  const supabase = await createClient();

  // --- 1. Wer ist das? -------------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  // --- 2. Kontingent ---------------------------------------------------------
  // Muss vor jedem KI-Aufruf passieren, sonst zahlen wir für Anfragen, die wir
  // anschliessend ablehnen.
  const [{ data: profil }, { data: verbraucht }] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("angebote_diesen_monat", { p_user_id: user.id }),
  ]);

  const erlaubnis = darfAngebotErstellen(
    profil?.subscription_status ?? "trial",
    verbraucht ?? 0,
  );
  if (!erlaubnis.erlaubt) {
    // 402 Payment Required: das Frontend kann daran die Abo-Aufforderung
    // von einem echten Fehler unterscheiden.
    return NextResponse.json({ fehler: erlaubnis.grund }, { status: 402 });
  }

  // --- 3. Eingabe ------------------------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ fehler: "Ungültige Anfrage." }, { status: 400 });
  }

  const kundeId = String(formData.get("kunde_id") ?? "") || null;
  const audio = formData.get("audio");
  const eingetippt = String(formData.get("text") ?? "").trim();

  let transkript = eingetippt;
  let audioSekunden = 0;

  if (audio instanceof File && audio.size > 0) {
    if (audio.size > AUDIO_MAX_BYTES) {
      return NextResponse.json(
        { fehler: "Die Aufnahme ist zu lang. Bitte kürzer fassen." },
        { status: 413 },
      );
    }

    try {
      const ergebnis = await transkribiere(audio);
      transkript = ergebnis.text;
      audioSekunden = ergebnis.sekunden;
    } catch {
      return NextResponse.json(
        { fehler: "Die Aufnahme konnte nicht verarbeitet werden. Bitte nochmal." },
        { status: 502 },
      );
    }

    if (audioSekunden > AUDIO_MAX_SEKUNDEN) {
      return NextResponse.json(
        { fehler: "Die Aufnahme ist zu lang (max. 10 Minuten)." },
        { status: 413 },
      );
    }
  }

  if (transkript.length < 10) {
    return NextResponse.json(
      {
        fehler:
          "Da war zu wenig zu hören. Beschreibe die Arbeiten in ein, zwei Sätzen.",
      },
      { status: 400 },
    );
  }

  // --- 4. Preisliste ---------------------------------------------------------
  const { data: preisliste } = await supabase
    .from("preisliste")
    .select("*")
    .eq("aktiv", true);

  // --- 5. Claude -------------------------------------------------------------
  let ergebnis;
  try {
    ergebnis = await extrahiereAngebot(
      transkript,
      (preisliste ?? []) as PreislisteEintrag[],
    );
  } catch (fehler) {
    console.error("[angebote/neu] Extraktion fehlgeschlagen", fehler);
    return NextResponse.json(
      {
        fehler:
          "Das Angebot konnte nicht erstellt werden. Bitte versuche es noch einmal.",
      },
      { status: 502 },
    );
  }

  // --- 6. Speichern ----------------------------------------------------------
  const { data: nummer, error: nummerFehler } = await supabase.rpc(
    "next_angebot_nummer",
    { p_user_id: user.id },
  );
  if (nummerFehler || !nummer) {
    return NextResponse.json(
      { fehler: "Das Angebot konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  const { data: firma } = await supabase
    .from("profiles")
    .select("mwst_satz, kleinunternehmer, angebot_gueltig_tage")
    .eq("id", user.id)
    .maybeSingle();

  const gueltigBis = new Date();
  gueltigBis.setDate(gueltigBis.getDate() + (firma?.angebot_gueltig_tage ?? 30));

  const { data: angebot, error: angebotFehler } = await supabase
    .from("angebote")
    .insert({
      user_id: user.id,
      kunde_id: kundeId,
      nummer,
      titel: ergebnis.titel,
      status: "entwurf",
      datum: new Date().toISOString().slice(0, 10),
      gueltig_bis: gueltigBis.toISOString().slice(0, 10),
      transkript,
      ki_hinweis: ergebnis.hinweis,
      // Kleinunternehmer weisen keine Umsatzsteuer aus.
      mwst_satz: firma?.kleinunternehmer ? 0 : (firma?.mwst_satz ?? 19),
      netto: 0,
      mwst_betrag: 0,
      brutto: 0,
      notiz: null,
      audio_path: null,
      pdf_path: null,
      gesendet_am: null,
      entschieden_am: null,
    })
    .select("id")
    .single();

  if (angebotFehler || !angebot) {
    console.error("[angebote/neu] Angebot anlegen fehlgeschlagen", angebotFehler);
    return NextResponse.json(
      { fehler: "Das Angebot konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  if (ergebnis.positionen.length > 0) {
    const { error: posFehler } = await supabase.from("positionen").insert(
      ergebnis.positionen.map((p, i) => ({
        angebot_id: angebot.id,
        pos_nr: i + 1,
        bezeichnung: p.bezeichnung,
        beschreibung: p.beschreibung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        preisliste_id: p.preisliste_id,
        zu_pruefen: p.zu_pruefen,
        ki_konfidenz: p.ki_konfidenz,
      })),
    );
    if (posFehler) {
      console.error("[angebote/neu] Positionen anlegen fehlgeschlagen", posFehler);
    }
  }

  // --- 7. Verbrauch protokollieren ------------------------------------------
  // Über den Admin-Client, weil `ki_nutzung` bewusst keine Insert-Policy hat:
  // der Client soll seinen eigenen Verbrauch nicht kleinschreiben können.
  // Ein Fehler hier darf das Angebot nicht kaputtmachen — deshalb ohne await
  // im Erfolgspfad geprüft und nur geloggt.
  const admin = createAdminClient();
  const nutzung = [];
  if (audioSekunden > 0) {
    nutzung.push({
      user_id: user.id,
      angebot_id: angebot.id,
      art: "transkription" as const,
      modell: "whisper-1",
      eingabe_token: 0,
      ausgabe_token: 0,
      cache_token: 0,
      audio_sekunden: audioSekunden,
      kosten_zehntelcent: transkriptionKosten(audioSekunden),
    });
  }
  nutzung.push({
    user_id: user.id,
    angebot_id: angebot.id,
    art: "extraktion" as const,
    modell: ergebnis.modell,
    eingabe_token: ergebnis.usage.inputTokens,
    ausgabe_token: ergebnis.usage.outputTokens,
    cache_token: ergebnis.usage.cacheReadTokens,
    audio_sekunden: 0,
    kosten_zehntelcent: extraktionKosten({
      modell: "claude-opus-5",
      eingabeToken: ergebnis.usage.inputTokens,
      ausgabeToken: ergebnis.usage.outputTokens,
      cacheToken: ergebnis.usage.cacheReadTokens,
    }),
  });

  const { error: nutzungFehler } = await admin.from("ki_nutzung").insert(nutzung);
  if (nutzungFehler) {
    console.error("[angebote/neu] Verbrauch nicht protokolliert", nutzungFehler);
  }

  return NextResponse.json({ angebotId: angebot.id });
}
