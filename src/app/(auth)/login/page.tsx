import { Meldung } from "@/components/ui/field";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden · Baustift" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { weiter?: string; fehler?: string };
}) {
  // `weiter` setzt die Middleware, wenn jemand ohne Session auf eine
  // geschützte Seite geht — nach dem Login landet er genau dort.
  const weiter = searchParams.weiter?.startsWith("/")
    ? searchParams.weiter
    : "/preisliste";

  return (
    <div className="flex flex-col gap-4">
      {searchParams.fehler ? (
        <Meldung art="fehler">{searchParams.fehler}</Meldung>
      ) : null}
      <LoginForm weiter={weiter} />
    </div>
  );
}
