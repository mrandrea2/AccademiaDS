import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/server";
export async function GET() {
  const db = await serverSupabase();
  if (!db) return NextResponse.json({ drafts: [] });
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ drafts: [] });
  const { data, error } = await db
    .from("teaching_drafts")
    .select(
      "*,materials(title,area,verification),material_versions(version,status)",
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error)
    return NextResponse.json({
      drafts: [],
      warning:
        "Contenuti approvati non disponibili: verifica la migration materiali.",
    });
  return NextResponse.json({
    drafts: (data ?? []).filter(
      (d) => d.material_versions?.status === "indexed",
    ),
  });
}
