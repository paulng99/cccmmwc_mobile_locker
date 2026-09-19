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
