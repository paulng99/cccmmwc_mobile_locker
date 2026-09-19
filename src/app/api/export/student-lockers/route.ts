import { NextResponse } from "next/server";
import { prisma, readUnusedStudentNos } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  compareSchoolPlace,
  formatHkDate,
  formatHkDateTime,
  parseSchoolPlace,
  parseUnusedStudentNos,
} from "@/lib/open-log";
import {
  buildLockerRows,
  buildStudentLockerWorkbook,
  exportFileName,
  type ExportLocale,
  type LockerStudentRow,
  type StudentLockerRow,
} from "@/lib/export-student-lockers";

function localeFrom(request: Request): ExportLocale {
  const { searchParams } = new URL(request.url);
  return searchParams.get("locale") === "en" ? "en" : "zh-HK";
}

export async function GET(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const [settings, occupied, students, unusedText] = await Promise.all([
    prisma.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.lockerCurrent.findMany(),
    prisma.studentCurrent.findMany(),
    readUnusedStudentNos(),
  ]);

  const unused = new Set(parseUnusedStudentNos(unusedText));
  const lockerRows: LockerStudentRow[] = buildLockerRows(
    occupied.map((row) => ({
      lockerCode: row.lockerCode,
      cabinet: row.cabinet,
      doorNo: row.doorNo,
      studentNo: row.studentNo,
      classCode: row.classCode,
      studentName: row.studentName,
      lastOpenedAt: row.lastOpenedAt ? formatHkDateTime(row.lastOpenedAt) : null,
    })),
    settings.doorsPerCabinet,
  );

  const byId = new Map<string, StudentLockerRow>();
  for (const row of students) {
    byId.set(row.studentNo.toUpperCase(), {
      studentNo: row.studentNo,
      classCode: row.classCode,
      studentName: row.studentName,
      lockerCode: row.lastLockerCode,
      lastOpenedAt: formatHkDateTime(row.lastOpenedAt),
      unused: unused.has(row.studentNo.toUpperCase()),
    });
  }
  for (const studentNo of unused) {
    if (byId.has(studentNo)) continue;
    const place = parseSchoolPlace(studentNo, "");
    byId.set(studentNo, {
      studentNo,
      classCode: place.classGroup,
      studentName: null,
      lockerCode: "",
      lastOpenedAt: null,
      unused: true,
    });
  }

  const studentRows = [...byId.values()].sort((a, b) =>
    compareSchoolPlace(parseSchoolPlace(a.studentNo, a.classCode), parseSchoolPlace(b.studentNo, b.classCode)),
  );

  const today = formatHkDate(new Date());
  const buffer = await buildStudentLockerWorkbook({
    locale: localeFrom(request),
    exportedAt: formatHkDateTime(new Date()),
    lockers: lockerRows,
    students: studentRows,
  });
  const filename = exportFileName(today);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
