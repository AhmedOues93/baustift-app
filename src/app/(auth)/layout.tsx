import Link from "next/link";

function WerkzeugMuster() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.12]">
      <span className="absolute left-[8%] top-[12%] rotate-[-18deg] text-5xl">⌁</span>
      <span className="absolute right-[10%] top-[18%] rotate-12 text-4xl">✎</span>
      <span className="absolute bottom-[18%] left-[12%] rotate-12 text-5xl">⌂</span>
      <span className="absolute bottom-[12%] right-[9%] rotate-[-14deg] text-4xl">✦</span>
      <svg className="absolute left-[4%] top-[42%] h-24 w-24 rotate-[-12deg]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M20 72 67 25l9 9-47 47H20v-9Z" />
        <path d="m61 31 9 9M27 66l8 8" />
      </svg>
      <svg className="absolute bottom-[34%] right-[4%] h-24 w-24 rotate-12" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M25 25h50v18H25zM34 43v34M66 43v34M28 77h44" />
      </svg>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <WerkzeugMuster />
      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="mb-7 flex items-center justify-center gap-3 text-text">
          <span className="flex h-11 w-11 items-center justify-center rounded-feld bg-tief text-xl font-black text-text-invers shadow-karte">B</span>
          <span className="font-titel text-2xl font-extrabold tracking-[0.14em]">BAUSTIFT</span>
        </Link>
        <div className="rounded-tafel border border-linie bg-flaeche/95 p-6 shadow-schwebend sm:p-8">
          {children}
        </div>
        <p className="mt-5 text-center text-xs text-text-leise">Angebote. Rechnungen. Weniger Papierkram.</p>
      </div>
    </div>
  );
}
