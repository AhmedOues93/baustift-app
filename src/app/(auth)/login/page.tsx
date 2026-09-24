import { Meldung } from "@/components/ui/field";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden · Baustift" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; fehler?: string }>;
}) {
  const { weiter: weiterRoh, fehler } = await searchParams;
  // `weiter` setzt die Middleware, wenn jemand ohne Session auf eine
  // geschützte Seite geht — nach dem Login landet er genau dort.
  const weiter = weiterRoh?.startsWith("/") ? weiterRoh : "/angebote";

  return (
    <div className="flex flex-col gap-4">
      {fehler ? (
        <Meldung art="fehler">{fehler}</Meldung>
      ) : null}
      <LoginForm weiter={weiter} />
    </div>
  );
}
