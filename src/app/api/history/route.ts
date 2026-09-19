import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatHkDateTime } from "@/lib/open-log";

export async function GET(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const studentNo = searchParams.get("studentNo");
  const lockerCode = searchParams.get("lockerCode");
  const rows = await prisma.openEvent.findMany({
    where: {
      ...(studentNo ? { studentNo } : {}),
      ...(lockerCode ? { lockerCode } : {}),
    },
    orderBy: { openedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    rows: rows.map((row) => ({
      id: String(row.id),
      openedAt: formatHkDateTime(row.openedAt),
      studentName: row.studentName,
      studentNo: row.studentNo,
      classCode: row.classCode,
      lockerCode: row.lockerCode,
      openType: row.openType,
      verifyMethod: row.verifyMethod,
      adminName: row.adminName,
      remark: row.remark,
    })),
  });
}
