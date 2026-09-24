import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function basisUrl(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const basis = basisUrl(request);
  const code = searchParams.get("code");
  const weiter = searchParams.get("weiter") ?? "/angebote";
  const fehler = searchParams.get("error_description");

  if (fehler) {
    return NextResponse.redirect(
      `${basis}/login?fehler=${encodeURIComponent(fehler)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        `${basis}${weiter.startsWith("/") ? weiter : "/angebote"}`,
      );
    }
  }

  return NextResponse.redirect(
    `${basis}/login?fehler=${encodeURIComponent("Anmeldung fehlgeschlagen.")}`,
  );
}
