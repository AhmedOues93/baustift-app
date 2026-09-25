import { NextResponse } from "next/server";

import { rechnungEn16931Xml } from "@/lib/erechnung/en16931";
import { createClient } from "@/lib/supabase/server";
import type { Kunde, Profile, Rechnung, RechnungPosition } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet.", { status: 401 });

  const { data: rechnung } = await supabase.from("rechnungen").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!rechnung) return new NextResponse("Rechnung nicht gefunden.", { status: 404 });
  if (!rechnung.festgeschrieben_am) return new NextResponse("E-Rechnung erst nach dem Stellen verfuegbar.", { status: 409 });

  const [{ data: positionen }, { data: firma }, { data: kunde }] = await Promise.all([
    supabase.from("rechnung_positionen").select("*").eq("rechnung_id", id).order("pos_nr"),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    rechnung.kunde_id
      ? supabase.from("kunden").select("*").eq("id", rechnung.kunde_id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!firma || !kunde) return new NextResponse("Firmen- oder Kundendaten fehlen.", { status: 422 });

  try {
    const xml = rechnungEn16931Xml({
      rechnung: rechnung as Rechnung,
      positionen: (positionen ?? []) as RechnungPosition[],
      kunde: kunde as Kunde,
      firma: firma as Profile,
    });
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="E-Rechnung-${rechnung.nummer}.xml"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("erechnung.xml", error);
    return new NextResponse(error instanceof Error ? error.message : "E-Rechnung konnte nicht erstellt werden.", { status: 422 });
  }
}
