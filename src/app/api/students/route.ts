import { NextResponse } from "next/server";
import { prisma, readUnusedStudentNos } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatHkDateTime, hkToday, parseSchoolPlace, parseUnusedStudentNos } from "@/lib/open-log";
import { listLockerAssignments } from "@/lib/import-rows";

type StudentListRow = {
  studentNo: string;
  classCode: string;
  studentName: string | null;
  lastLockerCode: string;
  assignedLockerCode: string;
  lastOpenedAt: string | null;
  lastOpenType: string;
  unused: boolean;
  todayOpenCount: number;
};

export async function GET(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const [rows, assignments] = await Promise.all([
    prisma.studentCurrent.findMany({
      orderBy: [{ classCode: "asc" }, { studentNo: "asc" }],
    }),
    listLockerAssignments(),
    prisma.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  ]);
  const unused = new Set(parseUnusedStudentNos(await readUnusedStudentNos()));
  const today = hkToday();
  const start = new Date(`${today}T00:00:00+08:00`);
  const end = new Date(`${today}T23:59:59.999+08:00`);
  const todayCounts = await prisma.openEvent.groupBy({
    by: ["studentNo"],
    where: { openedAt: { gte: start, lte: end } },
    _count: { _all: true },
  });
  const countByStudent = new Map(todayCounts.map((row) => [row.studentNo.toUpperCase(), row._count._all]));
  const byId = new Map<string, StudentListRow>(
    rows.map((row) => [
      row.studentNo.toUpperCase(),
      {
        studentNo: row.studentNo,
        classCode: row.classCode,
        studentName: row.studentName,
        lastLockerCode: row.lastLockerCode,
        assignedLockerCode: "",
        lastOpenedAt: formatHkDateTime(row.lastOpenedAt),
        lastOpenType: row.lastOpenType,
        unused: unused.has(row.studentNo.toUpperCase()),
        todayOpenCount: countByStudent.get(row.studentNo.toUpperCase()) ?? 0,
      },
    ]),
  );
  for (const assignment of assignments) {
    const id = assignment.studentNo.toUpperCase();
    const current = byId.get(id);
    if (current) {
      current.assignedLockerCode = assignment.lockerCode;
      if (!current.studentName && assignment.studentName) current.studentName = assignment.studentName;
      if (!current.classCode && assignment.classCode) current.classCode = assignment.classCode;
      continue;
    }
    const place = parseSchoolPlace(assignment.studentNo, assignment.classCode);
    byId.set(id, {
      studentNo: assignment.studentNo,
      classCode: place.classGroup || assignment.classCode,
      studentName: assignment.studentName,
      lastLockerCode: "",
      assignedLockerCode: assignment.lockerCode,
      lastOpenedAt: null,
      lastOpenType: "",
      unused: unused.has(id),
      todayOpenCount: countByStudent.get(id) ?? 0,
    });
  }
  for (const studentNo of unused) {
    if (byId.has(studentNo)) continue;
    const place = parseSchoolPlace(studentNo, "");
    byId.set(studentNo, {
      studentNo,
      classCode: place.classGroup,
      studentName: null,
      lastLockerCode: "",
      assignedLockerCode: "",
      lastOpenedAt: null,
      lastOpenType: "",
      unused: true,
      todayOpenCount: countByStudent.get(studentNo) ?? 0,
    });
  }
  const filtered = [...byId.values()].filter((row) => {
    if (!q) return true;
    return [row.classCode, row.studentNo, row.studentName ?? "", row.assignedLockerCode, row.lastLockerCode].some((value) =>
      value.toLowerCase().includes(q),
    );
  });
  return NextResponse.json({ rows: filtered });
}
