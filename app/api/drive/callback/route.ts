import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/ingestion/auth";
import {
  appUrl,
  exchangeCode,
  validateOAuthState,
} from "@/lib/ingestion/drive";
export async function GET(request: Request) {
  const jar = await cookies();
  try {
    const { user } = await requireAdmin();
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const cookie = jar.get("academy-drive-oauth")?.value;
    jar.delete({ name: "academy-drive-oauth", path: "/api/drive" });
    if (!state || !code || !cookie || url.searchParams.has("error"))
      throw new Error("OAuth non autorizzato");
    const verified = validateOAuthState(cookie, state, user.id);
    await exchangeCode(user.id, code, verified.verifier);
    return NextResponse.redirect(
      `${appUrl()}/?section=materiali&drive=connected`,
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Connessione Google non completata. Torna all’area Materiali, verifica configurazione e consenso e riprova.",
      },
      { status: 400 },
    );
  }
}
