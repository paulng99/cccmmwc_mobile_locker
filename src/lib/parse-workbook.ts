import ExcelJS from "exceljs";
import { mapFrpHeaderRow, mapHeaderRow, parseDataRow, parseFrpUserRow, type FrpUserRow, type OpenLogRow } from "./open-log";

export type ParseWorkbookResult = {
  rows: OpenLogRow[];
  skipped: number;
};

export type ParseFrpUserResult = {
  rows: FrpUserRow[];
  skipped: number;
};

async function loadFirstSheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.worksheets[0] ?? null;
}

function headerCells(sheet: ExcelJS.Worksheet): unknown[] {
  const cells: unknown[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    cells[col - 1] = cell.value;
  });
  return cells;
}

function rowCells(row: ExcelJS.Row): unknown[] {
  const cells: unknown[] = [];
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cells[col - 1] = cell.value;
  });
  return cells;
}

export async function parseOpenLogWorkbook(buffer: Buffer): Promise<ParseWorkbookResult> {
  const sheet = await loadFirstSheet(buffer);
  if (!sheet) return { rows: [], skipped: 0 };

  const headerMap = mapHeaderRow(headerCells(sheet));
  if (Object.keys(headerMap).length < 4) {
    throw new Error("excel_headers_mismatch");
  }

  const rows: OpenLogRow[] = [];
  let skipped = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const parsed = parseDataRow(rowCells(row), headerMap);
    if ("error" in parsed) {
      skipped += 1;
      return;
    }
    rows.push(parsed);
  });
  return { rows, skipped };
}

export async function parseFrpUserWorkbook(buffer: Buffer): Promise<ParseFrpUserResult> {
  const sheet = await loadFirstSheet(buffer);
  if (!sheet) return { rows: [], skipped: 0 };

  const headerMap = mapFrpHeaderRow(headerCells(sheet));
  if (!Object.values(headerMap).includes("studentNo")) {
    throw new Error("excel_headers_mismatch");
  }

  const rows: FrpUserRow[] = [];
  let skipped = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const parsed = parseFrpUserRow(rowCells(row), headerMap);
    if ("error" in parsed) {
      skipped += 1;
      return;
    }
    rows.push(parsed);
  });
  return { rows, skipped };
}
