import Link from "next/link";
import { redirect } from "next/navigation";

import { Plakette } from "@/components/ui/field";
import { formatEuro } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  RECHNUNG_STATUS_LABEL,
  type Kunde,
  type Rechnung,
  type RechnungStatus,
} from "@/types/database";

export const metadata = { title: "Rechnungen · Baustift" };

export default async function RechnungenPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rechnungen }, { data: kunden }] = await Promise.all([
    supabase.from("rechnungen").select("*").order("created_at", { ascending: false }),
    supabase.from("kunden").select("id, name"),
  ]);

  const kundenName = new Map(
    ((kunden ?? []) as Pick<Kunde, "id" | "name">[]).map((k) => [k.id, k.name]),
  );
  const alle = (rechnungen ?? []) as Rechnung[];

  // Zwei Zahlen reichen: was ist offen, und was davon ist zu spät.
  const offen = alle.filter((r) => r.status === "gestellt");
  const offenSumme = offen.reduce((s, r) => s + r.brutto, 0);
  const ueberfaellig = offen.filter((r) => istUeberfaellig(r));
  const ueberfaelligSumme = ueberfaellig.reduce((s, r) => s + r.brutto, 0);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[28px] leading-none">Rechnungen</h1>
        <p className="mt-1.5 text-sm text-text-leise">
          Entstehen aus angenommenen Angeboten.
        </p>
      </header>

      {alle.length > 0 ? (
        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-karte bg-flaeche p-4 shadow-karte">
            <p className="text-sm text-text-leise">Offen</p>
            <p className="zahl mt-1 text-xl font-semibold">{formatEuro(offenSumme)}</p>
            <p className="mt-0.5 text-xs text-text-leise">
              <span className="zahl">{offen.length}</span>{" "}
              {offen.length === 1 ? "Rechnung" : "Rechnungen"}
            </p>
          </div>
          <div
            className={`rounded-karte p-4 shadow-karte ${
              ueberfaellig.length > 0 ? "bg-warnung-flaeche" : "bg-flaeche"
            }`}
          >
            <p
              className={`text-sm ${ueberfaellig.length > 0 ? "text-warnung" : "text-text-leise"}`}
            >
              Überfällig
            </p>
            <p
              className={`zahl mt-1 text-xl font-semibold ${
                ueberfaellig.length > 0 ? "text-warnung" : "text-text"
              }`}
            >
              {formatEuro(ueberfaelligSumme)}
            </p>
            <p
              className={`mt-0.5 text-xs ${ueberfaellig.length > 0 ? "text-warnung" : "text-text-leise"}`}
            >
              {ueberfaellig.length > 0 ? "Zahlungsziel überschritten" : "alles im Plan"}
            </p>
          </div>
        </section>
      ) : null}

      {alle.length === 0 ? (
        <div className="rounded-karte border border-dashed border-linie p-8 text-center">
          <p className="font-titel text-lg font-bold tracking-tight text-text">
            Noch keine Rechnungen
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
            Sobald ein Angebot angenommen ist, machst du daraus mit einem Tipp
            eine Rechnung.
          </p>
          <Link
            href="/angebote"
            className="mt-4 inline-block text-sm font-medium text-akzent underline underline-offset-2"
          >
            Zu den Angeboten
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-4">
          {alle.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-karte bg-flaeche shadow-karte">
              <Link
                href={`/rechnungen/${r.id}`}
                className="flex min-h-14 items-center gap-3 p-4 transition-colors active:bg-papier"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">
                    {r.kunde_id ? kundenName.get(r.kunde_id) : r.titel || "Ohne Kunde"}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-text-leise">
                    {r.titel || "Ohne Titel"}
                  </span>
                  <span className="zahl mt-1 block text-xs text-text-leise">
                    {r.nummer} · {formatDatum(r.datum)}
                    {r.status === "gestellt" && r.faellig_am
                      ? ` · fällig ${formatDatum(r.faellig_am)}`
                      : ""}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="zahl whitespace-nowrap text-[15px] font-medium">
                    {formatEuro(r.brutto)}
                  </span>
                  <Plakette ton={ton(r)}>
                    {istUeberfaellig(r) ? "Überfällig" : RECHNUNG_STATUS_LABEL[r.status]}
                  </Plakette>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Gestellt, Zahlungsziel vorbei, noch kein Geld da. */
function istUeberfaellig(r: Rechnung): boolean {
  if (r.status !== "gestellt" || !r.faellig_am) return false;
  return new Date(r.faellig_am) < new Date(new Date().toDateString());
}

function ton(r: Rechnung) {
  if (istUeberfaellig(r)) return "warnung" as const;
  const nach: Record<RechnungStatus, "neutral" | "erfolg" | "warnung" | "info"> = {
    entwurf: "neutral",
    gestellt: "info",
    bezahlt: "erfolg",
    storniert: "warnung",
  };
  return nach[r.status];
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}
