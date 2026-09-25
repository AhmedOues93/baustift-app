import { rechnungPdfErzeugen } from "@/lib/pdf/erzeugen";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ergebnis = await rechnungPdfErzeugen(await createClient(), id);

    if (ergebnis.fehler !== undefined) {
      const status = ergebnis.fehler === "Nicht angemeldet." ? 401 : 404;
      return new Response(ergebnis.fehler, { status });
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(new Uint8Array(ergebnis.puffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ergebnis.dateiname}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("rechnung.pdf", error);
    return new Response("PDF konnte nicht erstellt werden.", { status: 500 });
  }
}
