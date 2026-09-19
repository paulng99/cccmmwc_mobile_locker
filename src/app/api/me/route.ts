import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";

export async function GET() {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, loginName: session.loginName });
}
