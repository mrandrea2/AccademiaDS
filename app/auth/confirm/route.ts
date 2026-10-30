import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { serverSupabase } from "@/lib/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const db = await serverSupabase();
  if (
    db &&
    token_hash &&
    ["signup", "email", "recovery", "magiclink"].includes(type ?? "")
  ) {
    const { error } = await db.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (!error)
      return NextResponse.redirect(
        new URL("/?section=impostazioni", url.origin),
      );
  }
  return NextResponse.redirect(
    new URL("/?section=impostazioni&auth_error=1", url.origin),
  );
}
