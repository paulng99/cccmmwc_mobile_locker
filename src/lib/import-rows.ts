import { prisma } from "./prisma";
import { formatHkDate, type FrpUserRow, type OpenLogRow, rowFingerprint } from "./open-log";

export async function importOpenLogRows(rows: OpenLogRow[], source: string) {
  let inserted = 0;
  for (const row of rows) {
    const fingerprint = rowFingerprint(row);
    try {
      await prisma.openEvent.create({
        data: {
          openedAt: row.openedAt,
          studentName: row.studentName,
          studentNo: row.studentNo,
          classCode: row.classCode,
          cabinet: row.cabinet,
          doorNo: row.doorNo,
          lockerCode: row.lockerCode,
          openType: row.openType,
          verifyMethod: row.verifyMethod,
          adminName: row.adminName,
          remark: row.remark,
          source,
          rowFingerprint: fingerprint,
          rawJson: row.raw,
        },
      });
      inserted += 1;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "P2002") throw error;
    }
  }

  await recomputeCurrentState();

  const maxDate =
    rows.length === 0
      ? null
      : rows.reduce((max, row) => (row.openedAt > max ? row.openedAt : max), rows[0].openedAt);

  await prisma.syncState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      lastAttemptAt: new Date(),
      lastSuccessAt: new Date(),
      lastSuccessOpenDate: maxDate ? formatHkDate(maxDate) : null,
      lastError: null,
      lastRowCount: inserted,
    },
    update: {
      lastAttemptAt: new Date(),
      lastSuccessAt: new Date(),
      lastSuccessOpenDate: maxDate ? formatHkDate(maxDate) : undefined,
      lastError: null,
      lastRowCount: inserted,
    },
  });

  return { inserted, total: rows.length };
}

export async function importLockerAssignments(rows: FrpUserRow[]) {
  const unique = new Map<string, FrpUserRow>();
  for (const row of rows) {
    unique.set(row.studentNo.toUpperCase(), row);
  }
  const data = [...unique.values()].map((row) => ({
    studentNo: row.studentNo,
    studentName: row.studentName,
    classCode: row.classCode,
    lockerCode: row.lockerCode,
    cabinet: row.cabinet,
    doorNo: row.doorNo,
  }));

  await prisma.$executeRaw`DELETE FROM locker_assignments`;
  for (const row of data) {
    await prisma.$executeRaw`
      INSERT INTO locker_assignments (student_no, student_name, class_code, locker_code, cabinet, door_no)
      VALUES (${row.studentNo}, ${row.studentName}, ${row.classCode}, ${row.lockerCode}, ${row.cabinet}, ${row.doorNo})
    `;
  }

  return { imported: data.length, total: rows.length };
}

export type LockerAssignmentRow = {
  studentNo: string;
  studentName: string | null;
  classCode: string;
  lockerCode: string;
  cabinet: string;
  doorNo: string;
};

export async function listLockerAssignments(cabinet?: string): Promise<LockerAssignmentRow[]> {
  const rows = cabinet
    ? await prisma.$queryRaw<Array<{
        student_no: string;
        student_name: string | null;
        class_code: string;
        locker_code: string;
        cabinet: string;
        door_no: string;
      }>>`
        SELECT student_no, student_name, class_code, locker_code, cabinet, door_no
        FROM locker_assignments
        WHERE cabinet = ${cabinet}
      `
    : await prisma.$queryRaw<Array<{
        student_no: string;
        student_name: string | null;
        class_code: string;
        locker_code: string;
        cabinet: string;
        door_no: string;
      }>>`
        SELECT student_no, student_name, class_code, locker_code, cabinet, door_no
        FROM locker_assignments
      `;
  return rows.map((row) => ({
    studentNo: row.student_no,
    studentName: row.student_name,
    classCode: row.class_code,
    lockerCode: row.locker_code,
    cabinet: row.cabinet,
    doorNo: row.door_no,
  }));
}

export async function recomputeCurrentState() {
  const latestStudents = await prisma.$queryRaw<
    {
      student_no: string;
      class_code: string;
      student_name: string | null;
      last_opened_at: Date;
      last_locker_code: string;
      last_open_type: string;
      last_event_id: bigint;
    }[]
  >`
    SELECT DISTINCT ON (student_no)
      student_no,
      class_code,
      student_name,
      opened_at AS last_opened_at,
      locker_code AS last_locker_code,
      open_type AS last_open_type,
      id AS last_event_id
    FROM open_events
    ORDER BY student_no, opened_at DESC, id DESC
  `;

  await prisma.studentCurrent.deleteMany();
  if (latestStudents.length > 0) {
    await prisma.studentCurrent.createMany({
      data: latestStudents.map((row) => ({
        studentNo: row.student_no,
        classCode: row.class_code,
        studentName: row.student_name,
        lastOpenedAt: row.last_opened_at,
        lastLockerCode: row.last_locker_code,
        lastOpenType: row.last_open_type,
        lastEventId: row.last_event_id,
      })),
    });
  }

  const latestLockers = await prisma.$queryRaw<
    {
      locker_code: string;
      cabinet: string;
      door_no: string;
      student_no: string | null;
      class_code: string | null;
      student_name: string | null;
      last_opened_at: Date | null;
      last_open_type: string | null;
      last_event_id: bigint | null;
    }[]
  >`
    SELECT DISTINCT ON (locker_code)
      locker_code,
      cabinet,
      door_no,
      student_no,
      class_code,
      student_name,
      opened_at AS last_opened_at,
      open_type AS last_open_type,
      id AS last_event_id
    FROM open_events
    ORDER BY locker_code, opened_at DESC, id DESC
  `;

  await prisma.lockerCurrent.deleteMany();
  if (latestLockers.length > 0) {
    await prisma.lockerCurrent.createMany({
      data: latestLockers.map((row) => ({
        lockerCode: row.locker_code,
        cabinet: row.cabinet,
        doorNo: row.door_no,
        studentNo: row.student_no,
        classCode: row.class_code,
        studentName: row.student_name,
        lastOpenedAt: row.last_opened_at,
        lastOpenType: row.last_open_type,
        lastEventId: row.last_event_id,
      })),
    });
  }
}

export async function recordSyncError(message: string) {
  await prisma.syncState.upsert({
    where: { id: 1 },
    create: { id: 1, lastAttemptAt: new Date(), lastError: message },
    update: { lastAttemptAt: new Date(), lastError: message },
  });
}
