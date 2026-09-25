import Link from "next/link";
import { redirect } from "next/navigation";

import { aufmassAnlegen } from "./actions";
import { Plakette } from "@/components/ui/field";
import { IconLineal, IconZurueck } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import type { Aufmass, Kunde } from "@/types/database";

export const metadata = { title: "Aufmass · Baustift" };

/**
 * Die Aufmasse.
 *
 * Bewusst keine eigene Schaltfläche in der Tab-Leiste: fünf Einträge sind auf
 * 390px schon die Obergrenze, und ein sechster macht alle schmaler. Der Weg
 * hierher führt über die Angebote — dort, wo man ohnehin ist, wenn man an ein
 * neues Angebot denkt.
 */
export default async function AufmassePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: aufmasse }, { data: kunden }] = await Promise.all([
    supabase.from("aufmass").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("kunden").select("id, name"),
  ]);

  const kundenName = new Map(
    ((kunden ?? []) as Pick<Kunde, "id" | "name">[]).map((k) => [k.id, k.name]),
  );
  const alle = (aufmasse ?? []) as Aufmass[];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/angebote"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-medium text-text-leise transition-colors active:bg-flaeche"
      >
        <IconZurueck className="h-4 w-4" />
        Angebote
      </Link>

      <header>
        <h1 className="text-[28px] leading-none">Aufmass</h1>
        <p className="mt-1.5 text-sm text-text-leise">
          Masse einsprechen, während du misst. Daraus wird das Angebot.
        </p>
      </header>

      <form action={aufmassAnlegen}>
        <button
          type="submit"
          className="flex w-full items-center gap-4 rounded-tafel bg-tief p-5 text-text-invers transition-colors active:bg-text"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-akzent">
            <IconLineal className="h-6 w-6" />
          </span>
          <span className="text-left">
            <span className="block font-titel text-lg font-bold tracking-tight">
              Neues Aufmass
            </span>
            <span className="block text-sm text-text-invers/70">
              Die Aufnahme läuft nicht mit — du misst in Ruhe weiter
            </span>
          </span>
        </button>
      </form>

      {alle.length === 0 ? (
        <div className="rounded-karte border border-dashed border-linie p-8 text-center">
          <p className="font-titel text-lg font-bold tracking-tight text-text">
            Noch kein Aufmass
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
            Du startest ein Aufmass, sprichst jedes Mass einzeln ein und siehst
            sofort, was verstanden wurde. Pausen sind egal.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-4">
          {alle.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-karte bg-flaeche shadow-karte">
              <Link
                href={`/aufmass/${a.id}`}
                className="flex min-h-14 items-center gap-3 p-4 transition-colors active:bg-papier"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">
                    {a.titel || "Ohne Titel"}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-text-leise">
                    {a.kunde_id ? kundenName.get(a.kunde_id) : "Ohne Kunde"}
                  </span>
                  <span className="zahl mt-1 block text-xs text-text-leise">
                    {formatDatum(a.created_at)}
                  </span>
                </span>
                <Plakette ton={a.angebot_id ? "erfolg" : a.status === "offen" ? "info" : "neutral"}>
                  {a.angebot_id
                    ? "Im Angebot"
                    : a.status === "offen"
                      ? "Offen"
                      : "Abgeschlossen"}
                </Plakette>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}
