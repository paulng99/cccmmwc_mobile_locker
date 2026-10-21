import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  candidateExportUrls,
  candidateFrpUserExportUrls,
  DEFAULT_LOCKER_AUTH_COOKIE_NAME,
  exportQuery,
  fetchExcelFromIntranet,
  formatAuthCookie,
  hasConfiguredAuthCookie,
  normalizeSessionPayload,
  parseAuthInput,
  resolveIntranetBaseUrl,
  resolveSessionInput,
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
    const cookie = ".AspNetCore.Face.CookieWithJwtAuth=abc123; divid=xyz";
    assert.deepEqual(parseAuthInput(cookie), { kind: "cookie", cookie });
  });

  it("extracts only the Cookie line from a raw HTTP request", () => {
    const raw = [
      "GET /api/Home/GetHomeData HTTP/1.1",
      "Accept: */*",
      "Cookie: pagemode=Tab; Face.Session=abc123; .AspNetCore.Face.CookieWithJwtAuth=token",
      "Host: 10.127.7.200:17789",
    ].join("\n");
    assert.deepEqual(parseAuthInput(raw), {
      kind: "cookie",
      cookie: "pagemode=Tab; Face.Session=abc123; .AspNetCore.Face.CookieWithJwtAuth=token",
    });
  });

  it("does not treat tea analytics json as a locker cookie", () => {
    const parsed = parseAuthInput(
      '{"sessionId":"584146e7-1515-497e-bd25-6c535a626e58","timestamp":1}',
    );
    assert.equal(parsed.kind, "none");
  });
});

describe("formatAuthCookie / resolveSessionInput", () => {
  const prevCookie = process.env.LOCKER_AUTH_COOKIE;
  const prevName = process.env.LOCKER_AUTH_COOKIE_NAME;
  const prevBase = process.env.LOCKER_INTRANET_BASE_URL;

  function restoreEnv() {
    if (prevCookie === undefined) delete process.env.LOCKER_AUTH_COOKIE;
    else process.env.LOCKER_AUTH_COOKIE = prevCookie;
    if (prevName === undefined) delete process.env.LOCKER_AUTH_COOKIE_NAME;
    else process.env.LOCKER_AUTH_COOKIE_NAME = prevName;
    if (prevBase === undefined) delete process.env.LOCKER_INTRANET_BASE_URL;
    else process.env.LOCKER_INTRANET_BASE_URL = prevBase;
  }

  it("prefixes a bare token with the Face cookie name", () => {
    assert.equal(
      formatAuthCookie("bareTokenOnly"),
      `${DEFAULT_LOCKER_AUTH_COOKIE_NAME}=bareTokenOnly`,
    );
  });

  it("keeps a name=value cookie string unchanged", () => {
    const cookie = ".AspNetCore.Face.CookieWithJwtAuth=already=set";
    assert.equal(formatAuthCookie(cookie), cookie);
  });

  it("prefers LOCKER_AUTH_COOKIE over DB payload", () => {
    try {
      process.env.LOCKER_AUTH_COOKIE = "envBareToken";
      delete process.env.LOCKER_AUTH_COOKIE_NAME;
      assert.equal(
        resolveSessionInput(".AspNetCore.Face.CookieWithJwtAuth=from-db"),
        `${DEFAULT_LOCKER_AUTH_COOKIE_NAME}=envBareToken`,
      );
      assert.equal(hasConfiguredAuthCookie(""), true);
    } finally {
      restoreEnv();
    }
  });

  it("falls back to DB payload when env cookie is empty", () => {
    try {
      delete process.env.LOCKER_AUTH_COOKIE;
      assert.equal(
        resolveSessionInput(".AspNetCore.Face.CookieWithJwtAuth=from-db"),
        ".AspNetCore.Face.CookieWithJwtAuth=from-db",
      );
      assert.equal(hasConfiguredAuthCookie(""), false);
    } finally {
      restoreEnv();
    }
  });

  it("prefers LOCKER_INTRANET_BASE_URL over DB base URL", () => {
    try {
      process.env.LOCKER_INTRANET_BASE_URL = "http://10.0.0.9:17789";
      assert.equal(resolveIntranetBaseUrl("http://10.127.7.200:17789"), "http://10.0.0.9:17789");
    } finally {
      restoreEnv();
    }
  });
});

describe("exportQuery", () => {
  it("keeps date-only bounds as start and end of day", () => {
    const query = exportQuery("2025-09-01", "2026-09-21");
    assert.ok(query.includes("startTime=2025-09-01+00%3A00%3A00"));
    assert.ok(query.includes("endTime=2026-09-21+23%3A59%3A59"));
  });

  it("passes a datetime start unchanged so incremental downloads stay small", () => {
    const query = exportQuery("2026-09-21 12:25:00", "2026-09-21 23:59:59");
    const params = new URLSearchParams(query);
    assert.equal(params.get("startTime"), "2026-09-21 12:25:00");
    assert.equal(params.get("Searcher.OpenDate"), "2026-09-21 12:25:00 ~ 2026-09-21 23:59:59");
    assert.equal(params.get("endTime"), "2026-09-21 23:59:59");
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

describe("candidateFrpUserExportUrls", () => {
  it("uses the WalkingTec FRPUser export path", () => {
    const urls = candidateFrpUserExportUrls("http://10.127.7.200:17789/");
    assert.equal(urls[0], "http://10.127.7.200:17789/Users/FRPUser/ExportExcel?1=1");
  });
});

describe("fetchExcelFromIntranet", () => {
  it("POSTs ExportExcel and accepts a real xlsx", async () => {
    const excel = new Uint8Array(80);
    excel[0] = 0x50;
    excel[1] = 0x4b;
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method, body: typeof init?.body === "string" ? init.body : "" });
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
      assert.ok(calls[0]?.body?.includes("startTime=2025-09-01+00%3A00%3A00"));
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
