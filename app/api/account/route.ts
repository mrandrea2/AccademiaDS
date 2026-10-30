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
  const { error } = await db.rpc("delete_own_account");
  if (error)
    return NextResponse.json(
      { error: "Cancellazione non riuscita" },
      { status: 500 },
    );
  await db.auth.signOut();
  return NextResponse.json({ deleted: true });
}
