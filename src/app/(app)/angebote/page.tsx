import Link from "next/link";

import { Button } from "@/components/ui/button";
import { IconMikrofon } from "@/components/ui/icons";

export const metadata = { title: "Angebote · Baustift" };

/** Platzhalter — die Angebotsliste kommt mit der Angebots-Pipeline. */
export default function AngebotePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Angebote</h1>
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
        <p className="font-medium text-slate-900">Noch keine Angebote</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
          Sprich deine Leistung ein — Baustift macht daraus ein Angebot.
        </p>
        <Link href="/angebote/neu" className="mt-4 inline-block">
          <Button>
            <IconMikrofon className="h-5 w-5" />
            Angebot aufnehmen
          </Button>
        </Link>
      </div>
    </div>
  );
}
