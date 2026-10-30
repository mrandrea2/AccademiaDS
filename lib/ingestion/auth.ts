import "server-only";
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/server";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireAdmin() {
  const db = await serverSupabase();
  if (!db)
    throw new ApiError(
      503,
      "Configura Supabase per accedere all’area materiali privata.",
    );
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new ApiError(401, "Accedi al tuo account.");
  const { data, error } = await db.rpc("is_material_admin");
  if (error)
    throw new ApiError(503, "Applica prima la migration materiali 002.");
  if (!data)
    throw new ApiError(
      403,
      "Account non abilitato all’amministrazione materiali.",
    );
  return { db, user };
}
export type AdminContext = Awaited<ReturnType<typeof requireAdmin>>;
export function adminHandler(
  handler: (request: Request, context: AdminContext) => Promise<Response>,
) {
  return async (request: Request) => {
    try {
      return await handler(request, await requireAdmin());
    } catch (error) {
      if (error instanceof ApiError)
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      return NextResponse.json(
        {
          error:
            "Operazione non riuscita. Nessun contenuto è stato pubblicato.",
        },
        { status: 500 },
      );
    }
  };
}
export function checkDb(error: { message: string } | null, label: string) {
  if (error) throw new ApiError(500, label);
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 250000)
    throw new ApiError(413, "Richiesta troppo grande.");
  try {
    const text = await request.text();
    if (text.length > 250000)
      throw new ApiError(413, "Richiesta troppo grande.");
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Richiesta JSON non valida.");
  }
}
