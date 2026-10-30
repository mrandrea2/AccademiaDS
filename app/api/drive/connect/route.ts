import { NextResponse } from "next/server";
import { adminHandler } from "@/lib/ingestion/auth";
import { createAuthorization } from "@/lib/ingestion/drive";
export const GET = adminHandler(async (_request, { user }) => {
  const auth = createAuthorization(user.id);
  const response = NextResponse.redirect(auth.url);
  response.cookies.set("academy-drive-oauth", auth.cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/drive",
    maxAge: 600,
  });
  return response;
});
