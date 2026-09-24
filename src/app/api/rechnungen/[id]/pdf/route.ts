import { rechnungPdfErzeugen } from "@/lib/pdf/erzeugen";
import { createClient } from "@/lib/supabase/server";

/** Rechnungs-PDF ausliefern — wie beim Angebot frisch gerendert. */
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ergebnis = await rechnungPdfErzeugen(await createClient(), id);

  if (ergebnis.fehler !== undefined) {
    const status = ergebnis.fehler === "Nicht angemeldet." ? 401 : 404;
    return new Response(ergebnis.fehler, { status });
  }

  return new Response(new Uint8Array(ergebnis.puffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${ergebnis.dateiname}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
