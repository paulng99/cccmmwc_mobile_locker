export const CABINETS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export const LOCKER_GRID_COLS = 6;
export const LOCKER_GRID_ROWS = 20;
export const LOCKER_GRID_SIZE = LOCKER_GRID_COLS * LOCKER_GRID_ROWS;

export type DoorTone = "vacant" | "usedToday" | "occupied";

export function doorTone(lastOpenedAt: string | null | undefined, today: string): DoorTone {
  if (!lastOpenedAt) return "vacant";
  return lastOpenedAt.slice(0, 10) === today ? "usedToday" : "occupied";
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
  const map: Record<number, string> = {};
  headers.forEach((header, index) => {
    const key = HEADER_MAP[normalizeHeader(cellText(header))];
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
