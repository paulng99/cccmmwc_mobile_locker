export const CABINETS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export const LOCKER_GRID_COLS = 6;
export const LOCKER_GRID_ROWS = 20;
export const LOCKER_GRID_SIZE = LOCKER_GRID_COLS * LOCKER_GRID_ROWS;

export type DoorTone = "vacant" | "usedToday" | "occupied";
export type StudentRowTone = "unused" | "usedToday" | "idleToday";

export function parseUnusedStudentNos(text: string | null | undefined): string[] {
  return [...new Set(
    (text ?? "")
      .split(/[\s,;]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
  )];
}

export function studentRowTone(options: { unused: boolean; todayOpenCount: number }): StudentRowTone {
  if (options.unused) return "unused";
  if (options.todayOpenCount > 0) return "usedToday";
  return "idleToday";
}

export function doorTone(
  lastOpenedAt: string | null | undefined,
  today: string,
  assigned = false,
): DoorTone {
  if (lastOpenedAt) {
    return lastOpenedAt.slice(0, 10) === today ? "usedToday" : "occupied";
  }
  return assigned ? "occupied" : "vacant";
}

export type SchoolPlace = {
  form: string;
  classLetter: string;
  classGroup: string;
  classNo: number;
};

const OTHER_PLACE: SchoolPlace = { form: "", classLetter: "", classGroup: "", classNo: 0 };

export function parseSchoolPlace(studentNo: string, classCode = ""): SchoolPlace {
  const id = studentNo.trim().toUpperCase();
  const fromId = id.match(/^(\d{1,2})([A-Z])(\d{1,3})$/);
  if (fromId) {
    return {
      form: fromId[1],
      classLetter: fromId[2],
      classGroup: `${fromId[1]}${fromId[2]}`,
      classNo: Number(fromId[3]),
    };
  }
  const fromClass = classCode.trim().toUpperCase().match(/^(\d{1,2})([A-Z])$/);
  if (fromClass) {
    const digits = id.match(/(\d{1,3})$/);
    return {
      form: fromClass[1],
      classLetter: fromClass[2],
      classGroup: `${fromClass[1]}${fromClass[2]}`,
      classNo: digits ? Number(digits[1]) : 0,
    };
  }
  return OTHER_PLACE;
}

export function compareSchoolPlace(a: SchoolPlace, b: SchoolPlace): number {
  const formA = a.form ? Number(a.form) : 99;
  const formB = b.form ? Number(b.form) : 99;
  if (formA !== formB) return formA - formB;
  if (a.classLetter !== b.classLetter) return a.classLetter.localeCompare(b.classLetter);
  if (a.classNo !== b.classNo) return a.classNo - b.classNo;
  return 0;
}
export type Cabinet = (typeof CABINETS)[number];

export type ParsedLocker = {
  cabinet: Cabinet;
  doorNo: string;
  lockerCode: string;
};

export type OpenLogRow = {
  studentName: string | null;
  studentNo: string;
  classCode: string;
  lockerRaw: string;
  cabinet: Cabinet;
  doorNo: string;
  lockerCode: string;
  openType: string;
  verifyMethod: string;
  adminName: string;
  remark: string;
  openedAt: Date;
  raw: Record<string, string>;
};

export type FrpUserRow = {
  studentName: string | null;
  studentNo: string;
  classCode: string;
  lockerRaw: string;
  cabinet: Cabinet | "";
  doorNo: string;
  lockerCode: string;
  raw: Record<string, string>;
};

const HEADER_MAP: Record<string, string> = {
  用户名: "studentName",
  用户编号: "studentNo",
  所属部门: "classCode",
  箱门: "lockerRaw",
  开箱类型: "openType",
  验证方式: "verifyMethod",
  管理员: "adminName",
  备注: "remark",
  开箱时间: "openedAt",
};

const FRP_HEADER_MAP: Record<string, string> = {
  姓名: "studentName",
  账号: "studentNo",
  用户编号: "studentNo",
  所属单位: "classCode",
  授权箱门: "lockerRaw",
  箱门: "lockerRaw",
};

export function parseLockerDoor(raw: string): ParsedLocker | null {
  const text = String(raw ?? "").trim();
  const match = text.match(/^([A-Ga-g])-(\d{1,3})\s*号箱$/);
  if (!match) return null;
  const cabinet = match[1].toUpperCase() as Cabinet;
  if (!CABINETS.includes(cabinet)) return null;
  const doorNo = match[2].padStart(3, "0");
  return { cabinet, doorNo, lockerCode: `${cabinet}-${doorNo}` };
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function formatHkDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function formatHkDateTime(date: Date): string {
  const datePart = formatHkDate(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  return `${datePart} ${time}`;
}

export function parseOpenedAt(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = value * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = text.replace(/\//g, "-").replace("T", " ");
  const match = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) {
    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, y, m, d, hh = "0", mm = "0", ss = "0"] = match;
  const iso = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm}:${ss}+08:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function rowFingerprint(row: {
  openedAt: Date;
  studentNo: string;
  lockerCode: string;
  openType: string;
}): string {
  return [
    row.openedAt.toISOString(),
    row.studentNo.trim(),
    row.lockerCode,
    row.openType.trim(),
  ].join("|");
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return formatHkDateTime(value);
  return String(value).trim();
}

export function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim();
}

export function mapHeaderRow(headers: unknown[]): Record<number, string> {
  return mapNamedHeaderRow(headers, HEADER_MAP);
}

export function mapFrpHeaderRow(headers: unknown[]): Record<number, string> {
  return mapNamedHeaderRow(headers, FRP_HEADER_MAP);
}

function mapNamedHeaderRow(headers: unknown[], names: Record<string, string>): Record<number, string> {
  const map: Record<number, string> = {};
  headers.forEach((header, index) => {
    const key = names[normalizeHeader(cellText(header))];
    if (key) map[index] = key;
  });
  return map;
}

export function parseDataRow(
  cells: unknown[],
  headerMap: Record<number, string>,
): OpenLogRow | { error: string } {
  const raw: Record<string, string> = {};
  const values: Record<string, string> = {};
  Object.entries(headerMap).forEach(([index, key]) => {
    const text = cellText(cells[Number(index)]);
    raw[key] = text;
    values[key] = text;
  });

  const studentNo = (values.studentNo ?? "").trim();
  const lockerRaw = values.lockerRaw ?? "";
  const openedAt = parseOpenedAt(cells[headerIndex(headerMap, "openedAt")] ?? values.openedAt);
  const locker = parseLockerDoor(lockerRaw);

  if (!studentNo) return { error: "missing_student_no" };
  if (!locker) return { error: "invalid_locker" };
  if (!openedAt) return { error: "invalid_opened_at" };

  return {
    studentName: emptyToNull(values.studentName ?? ""),
    studentNo,
    classCode: (values.classCode ?? "").trim(),
    lockerRaw,
    cabinet: locker.cabinet,
    doorNo: locker.doorNo,
    lockerCode: locker.lockerCode,
    openType: (values.openType ?? "").trim(),
    verifyMethod: (values.verifyMethod ?? "").trim(),
    adminName: (values.adminName ?? "").trim(),
    remark: (values.remark ?? "").trim(),
    openedAt,
    raw,
  };
}

export function parseFrpUserRow(
  cells: unknown[],
  headerMap: Record<number, string>,
): FrpUserRow | { error: string } {
  const raw: Record<string, string> = {};
  const values: Record<string, string> = {};
  Object.entries(headerMap).forEach(([index, key]) => {
    const text = cellText(cells[Number(index)]);
    raw[key] = text;
    values[key] = text;
  });

  const studentNo = (values.studentNo ?? "").trim();
  if (!studentNo) return { error: "missing_student_no" };

  const lockerRaw = (values.lockerRaw ?? "").trim();
  const locker = lockerRaw ? parseLockerDoor(lockerRaw) : null;
  if (lockerRaw && !locker) return { error: "invalid_locker" };

  const place = parseSchoolPlace(studentNo, values.classCode ?? "");
  const name = emptyToNull(values.studentName ?? "");
  return {
    studentName: name && name !== studentNo ? name : null,
    studentNo,
    classCode: place.classGroup || (values.classCode ?? "").trim(),
    lockerRaw,
    cabinet: locker?.cabinet ?? "",
    doorNo: locker?.doorNo ?? "",
    lockerCode: locker?.lockerCode ?? "",
    raw,
  };
}

function headerIndex(headerMap: Record<number, string>, key: string): number {
  const found = Object.entries(headerMap).find(([, value]) => value === key);
  return found ? Number(found[0]) : -1;
}

export function hkToday(): string {
  return formatHkDate(new Date());
}

export function overlapFromDate(lastSuccessOpenDate: string | null, firstImportDate: string): string {
  if (!lastSuccessOpenDate) return firstImportDate;
  return lastSuccessOpenDate;
}
