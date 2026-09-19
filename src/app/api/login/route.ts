import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const body = (await request.json()) as { loginName?: string; password?: string };
  const loginName = body.loginName?.trim() ?? "";
  const password = body.password ?? "";
  const user = await prisma.user.findUnique({ where: { loginName } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const session = await getSession();
  session.userId = user.id;
  session.loginName = user.loginName;
  await session.save();
  return NextResponse.json({ ok: true });
}
