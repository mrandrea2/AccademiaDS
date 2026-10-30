import { NextResponse } from "next/server";
import { adminHandler } from "@/lib/ingestion/auth";
import { disconnectDrive } from "@/lib/ingestion/drive";
export const POST = adminHandler(async (_request, { user }) => {
  await disconnectDrive(user.id);
  return NextResponse.json({ disconnected: true });
});
