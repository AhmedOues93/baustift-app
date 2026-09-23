import Link from "next/link";

/**
 * Layout für Login/Registrierung.
 * Mobile-first: volle Breite mit 20px Rand auf Elfenbein. Ab `sm` wird der
 * Inhalt zentriert und liegt auf einer weissen Karte — mehr braucht ein
 * Login-Screen auf dem Desktop nicht.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col px-5 py-8 sm:items-center sm:justify-center sm:py-12">
      <div className="w-full sm:max-w-md">
        <Link
          href="/"
          className="mb-8 inline-block py-2 font-titel text-xl font-extrabold tracking-tight text-text"
        >
          Baustift
        </Link>
        <div className="sm:rounded-karte sm:bg-flaeche sm:p-8 sm:shadow-karte">
          {children}
        </div>
      </div>
    </div>
  );
}
