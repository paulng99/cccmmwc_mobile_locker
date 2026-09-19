import ExcelJS from "exceljs";
import { CABINETS } from "./open-log";

export type ExportLocale = "zh-HK" | "en";

export type LockerStudentRow = {
  lockerCode: string;
  cabinet: string;
  doorNo: string;
  studentNo: string | null;
  classCode: string | null;
  studentName: string | null;
  lastOpenedAt: string | null;
};

export type StudentLockerRow = {
  studentNo: string;
  classCode: string;
  studentName: string | null;
  lockerCode: string;
  lastOpenedAt: string | null;
  unused: boolean;
};

const COPY: Record<
  ExportLocale,
  {
    lockerSheet: string;
    studentSheet: string;
    locker: string;
    name: string;
    studentNo: string;
    classCode: string;
    lastUsed: string;
    assigned: string;
    unused: string;
    vacant: string;
    yes: string;
  }
> = {
  "zh-HK": {
    lockerSheet: "箱門",
    studentSheet: "學生",
    locker: "箱門",
    name: "姓名",
    studentNo: "學號",
    classCode: "班別",
    lastUsed: "最後使用",
    assigned: "授權箱門",
    unused: "不使用",
    vacant: "空置",
    yes: "是",
  },
  en: {
    lockerSheet: "Lockers",
    studentSheet: "Students",
    locker: "Locker",
    name: "Name",
    studentNo: "Student no.",
    classCode: "Class",
    lastUsed: "Last used",
    assigned: "Assigned locker",
    unused: "Not using",
    vacant: "Vacant",
    yes: "Yes",
  },
};

export function formatLockerLabel(lockerCode: string): string {
  const code = lockerCode.trim();
  if (!code) return "";
  return /号箱$/.test(code) ? code : `${code}号箱`;
}

export function buildLockerRows(
  occupied: LockerStudentRow[],
  doorsPerCabinet: number,
): LockerStudentRow[] {
  const byCode = new Map(occupied.map((row) => [row.lockerCode, row]));
  const count = Math.max(1, Math.min(120, doorsPerCabinet || 120));
  const rows: LockerStudentRow[] = [];
  for (const cabinet of CABINETS) {
    for (let index = 1; index <= count; index += 1) {
      const doorNo = String(index).padStart(3, "0");
      const lockerCode = `${cabinet}-${doorNo}`;
      rows.push(
        byCode.get(lockerCode) ?? {
          lockerCode,
          cabinet,
          doorNo,
          studentNo: null,
          classCode: null,
          studentName: null,
          lastOpenedAt: null,
        },
      );
    }
  }
  return rows;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B3B8C" },
  };
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

function writeSheet(sheet: ExcelJS.Worksheet, headers: string[], rows: string[][], widths: number[]) {
  const header = sheet.addRow(headers);
  styleHeader(header);
  for (const values of rows) {
    sheet.addRow(values);
  }
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
}

export async function buildStudentLockerWorkbook(options: {
  locale: ExportLocale;
  exportedAt: string;
  lockers: LockerStudentRow[];
  students: StudentLockerRow[];
}): Promise<Buffer> {
  const copy = COPY[options.locale] ?? COPY["zh-HK"];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "cccmmwc-mobile-locker";
  workbook.created = new Date();
  workbook.description = options.exportedAt;

  const lockerSheet = workbook.addWorksheet(copy.lockerSheet);
  writeSheet(
    lockerSheet,
    [copy.locker, copy.name, copy.studentNo, copy.classCode, copy.lastUsed],
    options.lockers.map((row) => [
      formatLockerLabel(row.lockerCode),
      row.studentName ?? "",
      row.studentNo ?? "",
      row.classCode ?? "",
      row.lastOpenedAt ?? copy.vacant,
    ]),
    [16, 16, 14, 12, 22],
  );

  const studentSheet = workbook.addWorksheet(copy.studentSheet);
  writeSheet(
    studentSheet,
    [copy.studentNo, copy.name, copy.classCode, copy.assigned, copy.lastUsed, copy.unused],
    options.students.map((row) => [
      row.studentNo,
      row.studentName ?? "",
      row.classCode,
      row.lockerCode ? formatLockerLabel(row.lockerCode) : copy.vacant,
      row.lastOpenedAt ?? copy.vacant,
      row.unused ? copy.yes : "",
    ]),
    [14, 16, 12, 16, 22, 12],
  );

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function exportFileName(date: string): string {
  return `student-lockers-${date}.xlsx`;
}
