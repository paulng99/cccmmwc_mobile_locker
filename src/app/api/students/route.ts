import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatHkDateTime } from "@/lib/open-log";

export async function GET(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const rows = await prisma.studentCurrent.findMany({
    orderBy: [{ classCode: "asc" }, { studentNo: "asc" }],
  });
  const filtered = rows.filter((row) => {
    if (!q) return true;
    return [row.classCode, row.studentNo, row.studentName ?? ""].some((value) =>
      value.toLowerCase().includes(q),
    );
  });
  return NextResponse.json({
    rows: filtered.map((row) => ({
      studentNo: row.studentNo,
      classCode: row.classCode,
      studentName: row.studentName,
      lastLockerCode: row.lastLockerCode,
      lastOpenedAt: formatHkDateTime(row.lastOpenedAt),
      lastOpenType: row.lastOpenType,
    })),
  });
}
