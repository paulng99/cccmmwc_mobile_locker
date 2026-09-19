import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  candidateExportUrls,
  fetchExcelFromIntranet,
  normalizeSessionPayload,
  parseAuthInput,
} from "./intranet.ts";

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

describe("parseAuthInput", () => {
  it("treats empty as anonymous browser cookies", () => {
    assert.deepEqual(parseAuthInput(""), { kind: "none" });
  });

  it("treats an ASP.NET cookie header as cookie auth", () => {
    const cookie = ".AspNetCore.Identity.Application=abc123; divid=xyz";
    assert.deepEqual(parseAuthInput(cookie), { kind: "cookie", cookie });
  });

  it("does not treat tea analytics json as a locker cookie", () => {
    const parsed = parseAuthInput(
      '{"sessionId":"584146e7-1515-497e-bd25-6c535a626e58","timestamp":1}',
    );
    assert.equal(parsed.kind, "none");
  });
});

describe("candidateExportUrls", () => {
  it("uses the WalkingTec OpenLog export path", () => {
    const urls = candidateExportUrls("http://10.127.7.200:17789/", "", "2025-09-01", "2026-09-19");
    assert.equal(urls[0], "http://10.127.7.200:17789/Logs/OpenLog/ExportExcel?1=1");
  });

  it("includes configured path first", () => {
    const urls = candidateExportUrls("http://10.127.7.200:17789/", "/custom/export", "2025-09-01", "2026-09-19");
    assert.ok(urls.some((url) => url.startsWith("http://10.127.7.200:17789/custom/export")));
    assert.ok(urls.some((url) => url.includes("/Logs/OpenLog/ExportExcel")));
  });
});

describe("fetchExcelFromIntranet", () => {
  it("POSTs ExportExcel and accepts a real xlsx", async () => {
    const excel = new Uint8Array(80);
    excel[0] = 0x50;
    excel[1] = 0x4b;
    const calls: Array<{ url: string; method?: string }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method });
      return new Response(excel, {
        status: 200,
        headers: { "content-type": "application/vnd.ms-excel" },
      });
    }) as typeof fetch;
    try {
      const buffer = await fetchExcelFromIntranet({
        baseUrl: "http://10.127.7.200:17789",
        exportApiPath: "",
        storageKey: "__tea_session_id_586864",
        sessionInput: "",
        from: "2025-09-01",
        to: "2026-09-19",
      });
      assert.equal(calls[0]?.method, "POST");
      assert.equal(calls[0]?.url, "http://10.127.7.200:17789/Logs/OpenLog/ExportExcel?1=1");
      assert.equal(buffer.byteLength, 80);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("rejects a login-page HTML response", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("<script>window.location.href='/Login/Login'</script>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    try {
      await assert.rejects(
        () =>
          fetchExcelFromIntranet({
            baseUrl: "http://10.127.7.200:17789",
            exportApiPath: "",
            storageKey: "",
            sessionInput: "",
            from: "2025-09-01",
            to: "2026-09-19",
          }),
        /export_not_excel|need_locker_login/,
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});
