import ExcelJS from "exceljs";
import { mapHeaderRow, parseDataRow, type OpenLogRow } from "./open-log";

export type ParseWorkbookResult = {
  rows: OpenLogRow[];
  skipped: number;
};

export async function parseOpenLogWorkbook(buffer: Buffer): Promise<ParseWorkbookResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], skipped: 0 };

  const headerCells: unknown[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headerCells[col - 1] = cell.value;
  });
  const headerMap = mapHeaderRow(headerCells);
  if (Object.keys(headerMap).length < 4) {
    throw new Error("excel_headers_mismatch");
  }

  const rows: OpenLogRow[] = [];
  let skipped = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cell.value;
    });
    const parsed = parseDataRow(cells, headerMap);
    if ("error" in parsed) {
      skipped += 1;
      return;
    }
    rows.push(parsed);
  });
  return { rows, skipped };
}
