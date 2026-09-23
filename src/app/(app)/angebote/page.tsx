import Link from "next/link";

import { Button } from "@/components/ui/button";
import { IconMikrofon } from "@/components/ui/icons";

export const metadata = { title: "Angebote · Baustift" };

/** Platzhalter — die Angebotsliste kommt mit der Angebots-Pipeline. */
export default function AngebotePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[28px] leading-none">Angebote</h1>
      <div className="rounded-karte border border-dashed border-linie p-8 text-center">
        <p className="font-titel text-lg font-bold tracking-tight text-text">
          Noch keine Angebote
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
          Sprich deine Leistung ein — Baustift macht daraus ein Angebot.
        </p>
        <Link href="/angebote/neu" className="mt-4 inline-block">
          <Button variante="akzent">
            <IconMikrofon className="h-5 w-5" />
            Angebot aufnehmen
          </Button>
        </Link>
      </div>
    </div>
  );
}
