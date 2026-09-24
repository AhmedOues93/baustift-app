"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ weiter }: { weiter?: string }) {
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function los() {
    setLaedt(true);
    setFehler(null);

    const supabase = createClient();
    const basis =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      window.location.origin;
    const ziel = new URL("/auth/callback", basis);
    if (weiter) ziel.searchParams.set("weiter", weiter);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: ziel.toString() },
    });

    if (error) {
      setFehler("Google-Anmeldung ist gerade nicht verfügbar.");
      setLaedt(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variante="sekundaer" vollbreit onClick={los} disabled={laedt}>
        <GoogleLogo />
        {laedt ? "Weiterleitung…" : "Weiter mit Google"}
      </Button>
      {fehler ? <p className="text-sm text-warnung">{fehler}</p> : null}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z" />
      <path fill="#34A853" d="M12 23.5c3.11 0 5.72-1.03 7.62-2.8l-3.72-2.88c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.540-2.02-6.45-4.74H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z" />
      <path fill="#FBBC05" d="M5.55 14.18a6.9 6.9 0 0 1 0-4.36V6.84H1.7a11.5 11.5 0 0 0 0 10.32l3.85-2.98Z" />
      <path fill="#EA4335" d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.3 15.1.25 12 .25 7.52.25 3.65 2.82 1.7 6.84l3.85 2.98C6.46 7.1 9 4.75 12 4.75Z" />
    </svg>
  );
}
