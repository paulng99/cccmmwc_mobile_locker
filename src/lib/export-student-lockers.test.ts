import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  buildLockerRows,
  buildStudentLockerWorkbook,
  formatLockerLabel,
} from "./export-student-lockers.ts";

describe("formatLockerLabel", () => {
  it("uses the 智能柜 号箱 format", () => {
    assert.equal(formatLockerLabel("A-011"), "A-011号箱");
    assert.equal(formatLockerLabel(""), "");
  });
});

describe("buildLockerRows", () => {
  it("fills every door and keeps the occupied student", () => {
    const rows = buildLockerRows(
      [
        {
          lockerCode: "A-011",
          cabinet: "A",
          doorNo: "011",
          studentNo: "1A01",
          classCode: "1A",
          studentName: "陳大文",
          lastOpenedAt: "2026-09-19 08:15:00",
        },
      ],
      12,
    );
    assert.equal(rows.length, 7 * 12);
    const occupied = rows.find((row) => row.lockerCode === "A-011");
    const vacant = rows.find((row) => row.lockerCode === "A-001");
    assert.equal(occupied?.studentNo, "1A01");
    assert.equal(vacant?.studentNo, null);
  });
});

describe("buildStudentLockerWorkbook", () => {
  it("writes locker and student sheets with bilingual headers", async () => {
    const buffer = await buildStudentLockerWorkbook({
      locale: "zh-HK",
      exportedAt: "2026-09-19 16:50:00",
      lockers: [
        {
          lockerCode: "A-011",
          cabinet: "A",
          doorNo: "011",
          studentNo: "1A01",
          classCode: "1A",
          studentName: "陳大文",
          lastOpenedAt: "2026-09-19 08:15:00",
        },
      ],
      students: [
        {
          studentNo: "1A01",
          classCode: "1A",
          studentName: "陳大文",
          lockerCode: "A-011",
          lastOpenedAt: "2026-09-19 08:15:00",
          unused: false,
        },
        {
          studentNo: "1C02",
          classCode: "1C",
          studentName: null,
          lockerCode: "",
          lastOpenedAt: null,
          unused: true,
        },
      ],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const lockerSheet = workbook.getWorksheet("箱門");
    const studentSheet = workbook.getWorksheet("學生");
    assert.ok(lockerSheet);
    assert.ok(studentSheet);
    assert.equal(String(lockerSheet.getRow(1).getCell(1).value), "箱門");
    assert.equal(String(lockerSheet.getRow(2).getCell(1).value), "A-011号箱");
    assert.equal(String(lockerSheet.getRow(2).getCell(3).value), "1A01");
    assert.equal(String(studentSheet.getRow(1).getCell(1).value), "學號");
    assert.equal(String(studentSheet.getRow(2).getCell(4).value), "A-011号箱");
    assert.equal(String(studentSheet.getRow(3).getCell(1).value), "1C02");
    assert.equal(String(studentSheet.getRow(3).getCell(4).value), "空置");
  });
});
