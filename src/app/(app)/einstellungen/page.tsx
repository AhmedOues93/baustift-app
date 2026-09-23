import { abmelden } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Konto · Baustift" };

export default async function EinstellungenPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = await supabase
    .from("profiles")
    .select("firma_name")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] leading-none">Konto</h1>

      <dl className="rounded-karte bg-flaeche p-4 shadow-karte">
        <dt className="text-sm text-text-leise">Betrieb</dt>
        <dd className="font-medium">{profil?.firma_name || "—"}</dd>
        <dt className="mt-3 text-sm text-text-leise">E-Mail</dt>
        <dd className="break-all font-medium">{user?.email}</dd>
      </dl>

      <p className="text-sm text-text-leise">
        Firmendaten, Logo und Steuerangaben fürs Angebots-PDF kommen als
        Nächstes.
      </p>

      <form action={abmelden}>
        <Button type="submit" variante="sekundaer" vollbreit>
          Abmelden
        </Button>
      </form>
    </div>
  );
}
