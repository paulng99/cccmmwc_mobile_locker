import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseOpenLogWorkbook } from "./parse-workbook.ts";

describe("parseOpenLogWorkbook", () => {
  it("reads the nine simplified Chinese columns", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("OpenLog");
    sheet.addRow(["用户名", "用户编号", "所属部门", "箱门", "开箱类型", "验证方式", "管理员", "备注", "开箱时间"]);
    sheet.addRow(["陳大文", "12345", "1A", "B-032号箱", "取出", "刷卡", "", "", "2025-09-01 18:30:00"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parseOpenLogWorkbook(buffer);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].lockerCode, "B-032");
    assert.equal(parsed.rows[0].studentNo, "12345");
  });
});
