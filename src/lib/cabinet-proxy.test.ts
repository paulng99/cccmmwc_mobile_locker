import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCabinetServer } from "../cabinet-proxy-server.ts";
import { mergeUpstreamCookie, rewriteUpstreamLocation, stripCookieDomain } from "./cabinet-proxy.ts";

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve(address.port);
    });
  });
}

describe("mergeUpstreamCookie", () => {
  it("adds the settings cookie and drops the app session", () => {
    const header = mergeUpstreamCookie(
      "locker_session=secret; other=1",
      ".AspNetCore.Identity.Application=abc123",
    );
    assert.equal(header, "other=1; .AspNetCore.Identity.Application=abc123");
  });

  it("lets the saved cookie replace the same name", () => {
    const header = mergeUpstreamCookie("Face.Session=old", "Face.Session=new; divid=xyz");
    assert.equal(header, "Face.Session=new; divid=xyz");
  });

  it("ignores tea analytics json", () => {
    assert.equal(
      mergeUpstreamCookie(undefined, '{"sessionId":"584146e7-1515-497e-bd25-6c535a626e58"}'),
      undefined,
    );
  });
});

describe("rewriteUpstreamLocation", () => {
  it("keeps the browser on the proxy host", () => {
    const location = rewriteUpstreamLocation(
      "http://10.127.7.200:17789/Login/Login",
      new URL("http://10.127.7.200:17789"),
      "http://127.0.0.1:3001",
    );
    assert.equal(location, "http://127.0.0.1:3001/Login/Login");
  });
});

describe("stripCookieDomain", () => {
  it("removes Domain so the browser stores the cookie for the proxy host", () => {
    assert.equal(
      stripCookieDomain(".AspNetCore.Identity.Application=abc; domain=10.127.7.200; path=/"),
      ".AspNetCore.Identity.Application=abc; path=/",
    );
  });
});

describe("cabinet proxy", () => {
  it("forwards the settings cookie and not locker_session", async () => {
    let seen = "";
    const upstream = createServer((req, res) => {
      seen = req.headers.cookie ?? "";
      res.end("ok");
    });
    const upstreamPort = await listen(upstream);
    const proxy = createCabinetServer({
      hasSession: async () => true,
      loadSettings: async () => ({
        base: new URL(`http://127.0.0.1:${upstreamPort}`),
        sessionPayload: ".AspNetCore.Identity.Application=from-settings",
      }),
    });
    const proxyPort = await listen(proxy);
    try {
      const response = await fetch(`http://127.0.0.1:${proxyPort}/#/Users/FRPUser`, {
        headers: { cookie: "locker_session=app" },
      });
      assert.equal(response.status, 200);
      assert.equal(seen, ".AspNetCore.Identity.Application=from-settings");
    } finally {
      proxy.close();
      upstream.close();
    }
  });

  it("sends anonymous visitors to login", async () => {
    const proxy = createCabinetServer({
      hasSession: async () => false,
      loadSettings: async () => {
        throw new Error("should not load");
      },
      appPort: "3000",
    });
    const proxyPort = await listen(proxy);
    try {
      const response = await fetch(`http://127.0.0.1:${proxyPort}/`, { redirect: "manual" });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "http://127.0.0.1:3000/zh-HK/login");
    } finally {
      proxy.close();
    }
  });
});
