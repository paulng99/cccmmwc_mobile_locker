import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { candidateExportUrls, normalizeSessionPayload } from "./intranet.ts";

describe("normalizeSessionPayload", () => {
  it("wraps a raw uuid", () => {
    const parsed = normalizeSessionPayload("6d6012ea-1e79-4497-b572-bc4c014cd979");
    assert.ok(parsed);
    assert.equal(parsed.sessionId, "6d6012ea-1e79-4497-b572-bc4c014cd979");
  });

  it("reads json", () => {
    const parsed = normalizeSessionPayload(
      '{"sessionId":"6d6012ea-1e79-4497-b572-bc4c014cd979","timestamp":1}',
    );
    assert.deepEqual(parsed, {
      sessionId: "6d6012ea-1e79-4497-b572-bc4c014cd979",
      timestamp: 1,
    });
  });
});

describe("candidateExportUrls", () => {
  it("includes configured path and defaults", () => {
    const urls = candidateExportUrls("http://10.127.7.200:17789/", "/custom/export", "2025-09-01", "2026-09-19");
    assert.ok(urls.some((url) => url.startsWith("http://10.127.7.200:17789/custom/export?")));
    assert.ok(urls.some((url) => url.includes("OpenLog")));
  });
});
