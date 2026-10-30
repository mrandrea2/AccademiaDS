import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/server";
export async function DELETE(request: Request) {
  const db = await serverSupabase();
  if (!db)
    return NextResponse.json(
      { error: "Servizio non configurato" },
      { status: 503 },
    );
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Accesso richiesto" }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Conferma non valida" }, { status: 400 });
  }
  if (body.confirm !== "ELIMINA ACCOUNT")
    return NextResponse.json({ error: "Conferma non valida" }, { status: 400 });
  // Private originals must be removed before Auth deletion; the metadata cascades afterwards.
  const paths: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.rpc("own_material_cleanup_paths", {
      page_offset: offset,
    });
    if (error) {
      if (["PGRST202", "42883"].includes(error.code)) break;
      return NextResponse.json(
        {
          error:
            "Impossibile verificare gli originali privati prima della cancellazione.",
        },
        { status: 500 },
      );
    }
    paths.push(
      ...(data ?? []).map((row: { storage_path: string }) => row.storage_path),
    );
    if (!data || data.length < 500) break;
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage
      .from("academy-materials")
      .remove(paths.slice(i, i + 100));
    if (error)
      return NextResponse.json(
        {
          error:
            "Eliminazione originali non completata. Riprova prima di cancellare l’account.",
        },
        { status: 500 },
      );
  }
  const { error } = await db.rpc("delete_own_account");
  if (error)
    return NextResponse.json(
      { error: "Cancellazione non riuscita" },
      { status: 500 },
    );
  await db.auth.signOut();
  return NextResponse.json({ deleted: true });
}
