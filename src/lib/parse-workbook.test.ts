import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseFrpUserWorkbook, parseOpenLogWorkbook } from "./parse-workbook.ts";

describe("parseFrpUserWorkbook", () => {
  it("reads 账号 and 授权箱门 from the FRPUser export", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("FRPUser");
    sheet.addRow(["姓名", "账号", "所属单位", "状态", "联系电话", "照片", "已登记特征", "登记设备", "授权箱门", "创建时间"]);
    sheet.addRow(["陳大文", "1A01", "學生", "启用", "", "", "密码", "A", "A-011号箱", "2026-09-05 15:37:37"]);
    sheet.addRow(["1C02", "1C02", "學生", "启用", "", "", "密码", "", "", "2026-09-05 15:37:37"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parseFrpUserWorkbook(buffer);
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0].studentNo, "1A01");
    assert.equal(parsed.rows[0].lockerCode, "A-011");
    assert.equal(parsed.rows[0].cabinet, "A");
    assert.equal(parsed.rows[0].doorNo, "011");
    assert.equal(parsed.rows[1].studentNo, "1C02");
    assert.equal(parsed.rows[1].lockerCode, "");
  });
});

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
