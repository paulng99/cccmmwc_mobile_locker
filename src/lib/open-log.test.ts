import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseLockerDoor,
  parseOpenedAt,
  rowFingerprint,
  parseDataRow,
  mapHeaderRow,
  formatHkDate,
  overlapFromDate,
  doorTone,
  parseSchoolPlace,
  compareSchoolPlace,
} from "./open-log.ts";

describe("parseLockerDoor", () => {
  it("parses B-032号箱", () => {
    assert.deepEqual(parseLockerDoor("B-032号箱"), {
      cabinet: "B",
      doorNo: "032",
      lockerCode: "B-032",
    });
  });

  it("pads short door numbers", () => {
    assert.deepEqual(parseLockerDoor("A-3号箱"), {
      cabinet: "A",
      doorNo: "003",
      lockerCode: "A-003",
    });
  });

  it("rejects unknown cabinets", () => {
    assert.equal(parseLockerDoor("H-001号箱"), null);
  });
});

describe("parseOpenedAt", () => {
  it("parses yyyy-mm-dd HH:mm:ss as Hong Kong time", () => {
    const date = parseOpenedAt("2025-09-01 09:45:00");
    assert.ok(date);
    assert.equal(date.toISOString(), "2025-09-01T01:45:00.000Z");
    assert.equal(formatHkDate(date), "2025-09-01");
  });
});

describe("parseDataRow", () => {
  it("maps simplified Chinese headers", () => {
    const headers = mapHeaderRow([
      "用户名",
      "用户编号",
      "所属部门",
      "箱门",
      "开箱类型",
      "验证方式",
      "管理员",
      "备注",
      "开箱时间",
    ]);
    const row = parseDataRow(
      ["陳大文", "12345", "1A", "B-032号箱", "取出", "刷卡", "", "", "2025-09-01 18:30:00"],
      headers,
    );
    assert.ok(!("error" in row));
    if ("error" in row) return;
    assert.equal(row.studentName, "陳大文");
    assert.equal(row.studentNo, "12345");
    assert.equal(row.classCode, "1A");
    assert.equal(row.lockerCode, "B-032");
    assert.equal(row.openType, "取出");
    const again = parseDataRow(
      ["陳大文", "12345", "1A", "B-032号箱", "取出", "刷卡", "", "", "2025-09-01 18:30:00"],
      headers,
    );
    assert.ok(!("error" in again));
    if ("error" in again) return;
    assert.equal(rowFingerprint(row), rowFingerprint(again));
  });

  it("treats empty student name as null", () => {
    const headers = mapHeaderRow(["用户名", "用户编号", "所属部门", "箱门", "开箱类型", "开箱时间"]);
    const row = parseDataRow(["", "999", "2B", "C-001号箱", "存入", "2025-09-02 08:00:00"], headers);
    assert.ok(!("error" in row));
    if ("error" in row) return;
    assert.equal(row.studentName, null);
  });
});

describe("overlapFromDate", () => {
  it("uses first import date when never synced", () => {
    assert.equal(overlapFromDate(null, "2025-09-01"), "2025-09-01");
  });
});

describe("parseSchoolPlace", () => {
  it("reads form, class and number from 1A33", () => {
    assert.deepEqual(parseSchoolPlace("1A33", "學生"), {
      form: "1",
      classLetter: "A",
      classGroup: "1A",
      classNo: 33,
    });
  });

  it("reads 6D08", () => {
    const parsed = parseSchoolPlace("6D08", "");
    assert.equal(parsed.form, "6");
    assert.equal(parsed.classLetter, "D");
    assert.equal(parsed.classNo, 8);
  });

  it("falls back to classCode 2B", () => {
    assert.deepEqual(parseSchoolPlace("12", "2B"), {
      form: "2",
      classLetter: "B",
      classGroup: "2B",
      classNo: 12,
    });
  });

  it("sorts by form, class, then number", () => {
    const rows = ["2A03", "1C10", "1A02", "1A10"].map((id) => parseSchoolPlace(id, ""));
    rows.sort(compareSchoolPlace);
    assert.deepEqual(
      rows.map((row) => `${row.classGroup}${String(row.classNo).padStart(2, "0")}`),
      ["1A02", "1A10", "1C10", "2A03"],
    );
  });
});

describe("doorTone", () => {
  it("marks empty lockers vacant", () => {
    assert.equal(doorTone(null, "2026-09-19"), "vacant");
  });

  it("marks same Hong Kong date as used today", () => {
    assert.equal(doorTone("2026-09-19 10:05:50", "2026-09-19"), "usedToday");
  });

  it("marks older dates occupied", () => {
    assert.equal(doorTone("2026-09-02 10:05:50", "2026-09-19"), "occupied");
  });
});
