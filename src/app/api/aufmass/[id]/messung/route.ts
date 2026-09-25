import { NextResponse } from "next/server";

import { transkriptionKosten } from "@/lib/ai/kosten";
import { AUDIO_MAX_BYTES, transkribiere } from "@/lib/ai/transcribe";
import { parseMessung, type Messung } from "@/lib/aufmass/parse";
import { protokolliereFehler, protokolliereWarnung } from "@/lib/protokoll";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * =============================================================================
 * Eine einzelne Messung aufnehmen
 * =============================================================================
 * Der Endpunkt, der im Aufmass zwanzigmal hintereinander gerufen wird —
 * einmal pro Mass, das der Handwerker einspricht. Ablauf:
 *
 *   1. Session prüfen und dass das Aufmass ihm gehört und offen ist
 *   2. Anfragebremse (eigener Zähler, siehe unten)
 *   3. Audio → Text (Whisper, mit Aufmass-Vokabular) oder getippter Text
 *   4. Text → Mass (Parser; erst wenn der nicht weiterweiss, die KI)
 *   5. Speichern und zurückgeben
 *
 * Bewusst KEIN Speichern der Aufnahme — wie beim Angebot. Der gesprochene
 * Satz bleibt am Datensatz stehen, damit ein Wert prüfbar ist: wer "2,50"
 * gesagt hat und "250" sieht, soll das nachvollziehen können.
 *
 * Die Antwort enthält die fertige Zeile, damit der Bildschirm sie sofort
 * anzeigen kann. Genau das ist der Unterschied zu einer durchlaufenden
 * Aufnahme: der Handwerker sieht jedes Mass in dem Moment, in dem er es
 * gesprochen hat, und nicht erst am Ende.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Höher als beim Angebot, und mit eigenem Zähler (Migration 0013).
 *
 * Beim Ausmessen eines Bades kommen zwanzig Messungen in wenigen Minuten.
 * Mit dem Angebots-Limit von fünf pro Minute bräche die Bremse mitten im
 * Aufmass ein — ausgerechnet dann, wenn er im Takt ist. Dreissig pro Minute
 * erreicht niemand, der wirklich misst, und begrenzt trotzdem eine Schleife.
 */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_FENSTER_SEKUNDEN = 60;

/** Länger als das braucht kein einzelnes Mass — dann lief der Knopf mit. */
const MAX_SEKUNDEN = 30;

interface Antwort {
  messung?: unknown;
  /** Was Whisper verstanden hat — auch im Fehlerfall nützlich. */
  gesprochen?: string;
  fehler?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<Antwort>> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  // --- 1. Gehört das Aufmass ihm, und ist es offen? --------------------------
  const { data: aufmass } = await supabase
    .from("aufmass")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!aufmass) {
    return NextResponse.json({ fehler: "Aufmass nicht gefunden." }, { status: 404 });
  }
  if (aufmass.status === "abgeschlossen") {
    return NextResponse.json(
      { fehler: "Das Aufmass ist abgeschlossen. Zum Ändern zuerst wieder öffnen." },
      { status: 409 },
    );
  }

  // --- 2. Anfragebremse ------------------------------------------------------
  const { data: darf, error: bremseFehler } = await supabase.rpc(
    "ki_anfrage_erlaubt",
    {
      p_user_id: user.id,
      p_max: RATE_LIMIT_MAX,
      p_fenster_sekunden: RATE_LIMIT_FENSTER_SEKUNDEN,
      p_art: "aufmass",
    },
  );
  if (bremseFehler) {
    protokolliereWarnung(
      { vorgang: "aufmass.anfragebremse", userId: user.id },
      bremseFehler,
    );
  } else if (darf === false) {
    return NextResponse.json(
      { fehler: "Zu viele Messungen in kurzer Zeit. Kurz durchatmen." },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  // --- 3. Eingabe ------------------------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ fehler: "Ungültige Anfrage." }, { status: 400 });
  }

  const audio = formData.get("audio");
  const eingetippt = String(formData.get("text") ?? "").trim();

  let gesprochen = eingetippt;
  let sekunden = 0;

  if (audio instanceof File && audio.size > 0) {
    if (audio.size > AUDIO_MAX_BYTES) {
      return NextResponse.json({ fehler: "Die Aufnahme ist zu lang." }, { status: 413 });
    }
    try {
      const ergebnis = await transkribiere(audio, "aufmass");
      gesprochen = ergebnis.text;
      sekunden = ergebnis.sekunden;
    } catch (fehler) {
      protokolliereFehler({ vorgang: "aufmass.transkription", userId: user.id }, fehler);
      return NextResponse.json(
        { fehler: "Die Aufnahme konnte nicht verarbeitet werden. Nochmal." },
        { status: 502 },
      );
    }

    if (sekunden > MAX_SEKUNDEN) {
      return NextResponse.json(
        { fehler: "Das war lang für ein einzelnes Mass. Kürzer fassen." },
        { status: 413 },
      );
    }
  }

  if (gesprochen.length < 2) {
    return NextResponse.json(
      { fehler: "Da war nichts zu hören. Nochmal, näher am Mikrofon." },
      { status: 400 },
    );
  }

  // --- 4. Deuten -------------------------------------------------------------
  // Der Parser zuerst: er ist sofort da und kostet nichts. Versteht er den
  // Satz nicht, legen wir die Zeile trotzdem an — mit dem gesprochenen Text
  // und zum Prüfen markiert. Eine leere Zeile mit dem eigenen Wortlaut ist
  // brauchbarer als eine Fehlermeldung: der Handwerker trägt die zwei Zahlen
  // in fünf Sekunden nach und misst weiter.
  const gedeutet: Messung | null = parseMessung(gesprochen);

  // --- 5. Speichern ----------------------------------------------------------
  const { data: letzte } = await supabase
    .from("aufmass_positionen")
    .select("pos_nr")
    .eq("aufmass_id", id)
    .order("pos_nr", { ascending: false })
    .limit(1)
    .maybeSingle();

  const posNr = (letzte?.pos_nr ?? 0) + 1;

  const { data: messung, error: speicherFehler } = await supabase
    .from("aufmass_positionen")
    .insert({
      aufmass_id: id,
      pos_nr: posNr,
      raum: gedeutet?.raum ?? null,
      bezeichnung: gedeutet?.bezeichnung ?? "",
      art: gedeutet?.art ?? "flaeche",
      laenge: gedeutet?.laenge ?? null,
      breite: gedeutet?.breite ?? null,
      hoehe: gedeutet?.hoehe ?? null,
      anzahl: gedeutet?.anzahl ?? 1,
      abzug: gedeutet?.abzug ?? false,
      gesprochen,
      // Nicht verstanden heisst immer "zu prüfen" — genau wie eine Position
      // ohne Preis im Angebot. Kein Fehler, eine offene Frage.
      zu_pruefen: gedeutet?.zuPruefen ?? true,
    })
    .select("*")
    .single();

  if (speicherFehler || !messung) {
    protokolliereFehler(
      { vorgang: "aufmass.messung", userId: user.id },
      speicherFehler,
    );
    return NextResponse.json(
      { fehler: "Die Messung konnte nicht gespeichert werden.", gesprochen },
      { status: 500 },
    );
  }

  // --- 6. Verbrauch ----------------------------------------------------------
  // Über den Admin-Client, weil `ki_nutzung` keine Insert-Policy hat.
  if (sekunden > 0) {
    const admin = createAdminClient();
    const { error } = await admin.from("ki_nutzung").insert({
      user_id: user.id,
      angebot_id: null,
      art: "transkription",
      modell: "whisper-1",
      eingabe_token: 0,
      ausgabe_token: 0,
      cache_token: 0,
      audio_sekunden: sekunden,
      kosten_zehntelcent: transkriptionKosten(sekunden),
    });
    if (error) {
      protokolliereWarnung({ vorgang: "aufmass.verbrauch", userId: user.id }, error);
    }
  }

  return NextResponse.json({ messung, gesprochen });
}
