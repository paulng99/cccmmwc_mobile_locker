import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv.ts";

describe("toCsv", () => {
  it("prefixes a UTF-8 BOM and quotes commas, quotes, and newlines", () => {
    const csv = toCsv(["Name", "Note"], [["Chan, Tai Man", 'He said "hi"'], ["Lee\nMei", "ok"]]);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.equal(
      csv.slice(1),
      'Name,Note\r\n"Chan, Tai Man","He said ""hi"""\r\n"Lee\nMei",ok\r\n',
    );
  });
});
