import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CABINETS, LOCKER_GRID_SIZE, formatHkDateTime } from "@/lib/open-log";
import { listLockerAssignments } from "@/lib/import-rows";

export async function GET(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const cabinet = (searchParams.get("cabinet") ?? "A").toUpperCase();
  if (!CABINETS.includes(cabinet as (typeof CABINETS)[number])) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const [occupied, assigned] = await Promise.all([
    prisma.lockerCurrent.findMany({ where: { cabinet } }),
    listLockerAssignments(cabinet),
  ]);
  const byDoor = new Map(occupied.map((row) => [row.doorNo, row]));
  const byAssigned = new Map(
    assigned.filter((row) => row.doorNo).map((row) => [row.doorNo, row]),
  );
  const doorCount = LOCKER_GRID_SIZE;
  const doors = Array.from({ length: doorCount }, (_, index) => {
    const doorNo = String(index + 1).padStart(3, "0");
    const current = byDoor.get(doorNo);
    const link = byAssigned.get(doorNo);
    return {
      lockerCode: `${cabinet}-${doorNo}`,
      doorNo,
      assigned: Boolean(link?.studentNo),
      vacant: !link?.studentNo && !current?.lastOpenedAt,
      studentNo: link?.studentNo ?? current?.studentNo ?? null,
      classCode: link?.classCode ?? current?.classCode ?? null,
      studentName: link?.studentName ?? current?.studentName ?? null,
      lastOpenedAt: current?.lastOpenedAt ? formatHkDateTime(current.lastOpenedAt) : null,
      lastOpenType: current?.lastOpenType ?? null,
    };
  });
  return NextResponse.json({ cabinet, doors });
}
