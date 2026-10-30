import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/server";
import { stateSchema } from "@/lib/validation";
export async function GET() {
  const db = await serverSupabase();
  if (!db)
    return NextResponse.json(
      { error: "Supabase non configurato" },
      { status: 503 },
    );
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Accedi per continuare" },
      { status: 401 },
    );
  const { data, error } = await db
    .from("profiles")
    .select("study_state,revision")
    .eq("id", user.id)
    .single();
  if (error)
    return NextResponse.json(
      { error: "Profilo non disponibile. Verifica le migrations." },
      { status: 500 },
    );
  return NextResponse.json(data);
}
export async function PUT(request: Request) {
  if (Number(request.headers.get("content-length")) > 2500000)
    return NextResponse.json(
      { error: "Archivio troppo grande" },
      { status: 413 },
    );
  const db = await serverSupabase();
  if (!db)
    return NextResponse.json(
      { error: "Supabase non configurato" },
      { status: 503 },
    );
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Accesso richiesto" }, { status: 401 });
  try {
    const body = await request.json();
    if (body.ownerId !== user.id)
      return NextResponse.json(
        { error: "Sessione cambiata: ricarica prima di salvare." },
        { status: 409 },
      );
    const parsed = stateSchema.safeParse(body.state);
    if (!parsed.success || !Number.isInteger(body.revision))
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    if (JSON.stringify(parsed.data).length > 2500000)
      return NextResponse.json(
        { error: "Archivio troppo grande: esporta e riduci i documenti" },
        { status: 413 },
      );
    const { data, error } = await db.rpc("save_workspace", {
      workspace: parsed.data,
      expected_revision: body.revision,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === "40001"
              ? "Conflitto: ricarica la pagina prima di modificare altri dati."
              : "Salvataggio non riuscito. Verifica migrations e connessione.",
        },
        { status: error.code === "40001" ? 409 : 500 },
      );
    return NextResponse.json({ revision: data });
  } catch {
    return NextResponse.json(
      { error: "Richiesta non valida" },
      { status: 400 },
    );
  }
}
