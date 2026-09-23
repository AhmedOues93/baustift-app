import Link from "next/link";

/**
 * Layout für Login/Registrierung.
 * Mobile-first: volle Breite mit 20px Rand. Ab `sm` wird der Inhalt zentriert
 * und bekommt eine Karte — mehr braucht ein Login-Screen auf dem Desktop nicht.
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
          className="mb-8 inline-block text-lg font-bold tracking-tight text-brand-700"
        >
          Baustift
        </Link>
        <div className="sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:p-8 sm:shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
