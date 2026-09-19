import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CABINETS, formatHkDateTime } from "@/lib/open-log";

export async function GET(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const cabinet = (searchParams.get("cabinet") ?? "A").toUpperCase();
  if (!CABINETS.includes(cabinet as (typeof CABINETS)[number])) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const occupied = await prisma.lockerCurrent.findMany({
    where: { cabinet },
  });
  const byDoor = new Map(occupied.map((row) => [row.doorNo, row]));
  const doors = Array.from({ length: settings.doorsPerCabinet }, (_, index) => {
    const doorNo = String(index + 1).padStart(3, "0");
    const current = byDoor.get(doorNo);
    return {
      lockerCode: `${cabinet}-${doorNo}`,
      doorNo,
      vacant: !current?.lastOpenedAt,
      studentNo: current?.studentNo ?? null,
      classCode: current?.classCode ?? null,
      studentName: current?.studentName ?? null,
      lastOpenedAt: current?.lastOpenedAt ? formatHkDateTime(current.lastOpenedAt) : null,
      lastOpenType: current?.lastOpenType ?? null,
    };
  });
  return NextResponse.json({ cabinet, doors });
}
