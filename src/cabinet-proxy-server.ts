import http from "node:http";
import https from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  cookieValue,
  mergeUpstreamCookie,
  rewriteUpstreamLocation,
  stripCookieDomain,
} from "./lib/cabinet-proxy.ts";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

const FAIL_HTML = `<!doctype html>
<meta charset="utf-8">
<title>智能柜</title>
<body style="font-family:sans-serif;padding:2rem;color:#16324f">
<p>未能連接智能柜。請確認這部電腦已連接學校網絡，而且設定裡的內聯網網址正確。</p>
<p>Cannot reach 智能柜. Check the school network and the intranet URL in Settings.</p>
</body>`;

export type CabinetSettings = {
  base: URL;
  sessionPayload: string;
};

export type CabinetDeps = {
  loadSettings: () => Promise<CabinetSettings>;
  hasSession: (cookieHeader: string | undefined) => Promise<boolean>;
  appPort?: string;
};

function publicOrigin(req: IncomingMessage): string {
  const host = req.headers.host ?? "127.0.0.1:3001";
  return `http://${host}`;
}

function loginLocation(req: IncomingMessage, appPort: string): string {
  const host = req.headers.host ?? "127.0.0.1:3001";
  const hostname = host.replace(/:\d+$/, "");
  return `http://${hostname}:${appPort}/zh-HK/login`;
}

function send(res: ServerResponse, status: number, location?: string, html?: string) {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (location) {
    res.writeHead(status, { Location: location, "Cache-Control": "no-store" });
    res.end();
    return;
  }
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html ?? "");
}

export function createCabinetServer(deps: CabinetDeps) {
  return http.createServer((req, res) => {
    void proxyCabinetRequest(req, res, deps);
  });
}

export async function proxyCabinetRequest(req: IncomingMessage, res: ServerResponse, deps: CabinetDeps) {
  const url = req.url ?? "/";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    send(res, 400);
    return;
  }
  const appPort = deps.appPort ?? process.env.LOCKER_APP_PORT ?? "3000";
  let allowed = false;
  try {
    allowed = await deps.hasSession(req.headers.cookie);
  } catch {
    allowed = false;
  }
  if (!allowed) {
    send(res, 302, loginLocation(req, appPort));
    return;
  }

  let settings: CabinetSettings;
  try {
    settings = await deps.loadSettings();
  } catch {
    send(res, 502, undefined, FAIL_HTML);
    return;
  }

  const lib = settings.base.protocol === "https:" ? https : http;
  const headers: http.OutgoingHttpHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || HOP_BY_HOP.has(key.toLowerCase()) || key.toLowerCase() === "cookie" || key.toLowerCase() === "host") {
      continue;
    }
    headers[key] = value;
  }
  headers.host = settings.base.host;
  const cookie = mergeUpstreamCookie(req.headers.cookie, settings.sessionPayload);
  if (cookie) headers.cookie = cookie;

  const upstreamReq = lib.request(
    {
      protocol: settings.base.protocol,
      hostname: settings.base.hostname,
      port: settings.base.port || (settings.base.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: url,
      headers,
    },
    (upstreamRes) => {
      const out: http.OutgoingHttpHeaders = {};
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (!value || HOP_BY_HOP.has(key.toLowerCase())) continue;
        const lower = key.toLowerCase();
        if (lower === "location" && typeof value === "string") {
          out.location = rewriteUpstreamLocation(value, settings.base, publicOrigin(req));
          continue;
        }
        if (lower === "set-cookie") {
          const list = (Array.isArray(value) ? value : [value]).map(stripCookieDomain);
          out["set-cookie"] = list;
          continue;
        }
        if (typeof value === "string") {
          out[key] = value.split(settings.base.origin).join(publicOrigin(req));
          continue;
        }
        out[key] = value;
      }
      res.writeHead(upstreamRes.statusCode ?? 502, out);
      upstreamRes.pipe(res);
    },
  );
  upstreamReq.setTimeout(20000, () => upstreamReq.destroy(new Error("timeout")));
  upstreamReq.on("error", () => send(res, 502, undefined, FAIL_HTML));
  req.on("aborted", () => upstreamReq.destroy());
  req.pipe(upstreamReq);
}

async function hasAppSession(cookieHeader: string | undefined): Promise<boolean> {
  const seal = cookieValue(cookieHeader, "locker_session");
  if (!seal) return false;
  const password = process.env.SESSION_SECRET ?? "build-placeholder-secret-32-chars!!";
  if (password.length < 32) return false;
  try {
    const { unsealData } = await import("iron-session");
    const data = await unsealData<{ userId?: string }>(seal, { password });
    return Boolean(data.userId);
  } catch {
    return false;
  }
}

async function loadSettingsFromDb(): Promise<CabinetSettings> {
  const { prisma } = await import("./lib/prisma.ts");
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const base = new URL(settings?.intranetBaseUrl || "http://10.127.7.200:17789");
  return { base, sessionPayload: settings?.sessionPayload ?? "" };
}

const globalForProxy = globalThis as typeof globalThis & { cabinetProxyStarted?: boolean };

export function startCabinetProxy() {
  if (globalForProxy.cabinetProxyStarted) return;
  globalForProxy.cabinetProxyStarted = true;
  const port = Number(process.env.CABINET_PROXY_PORT ?? 3001);
  const server = createCabinetServer({
    loadSettings: loadSettingsFromDb,
    hasSession: hasAppSession,
  });
  server.on("error", (error) => {
    console.error("cabinet proxy failed", error);
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`cabinet proxy listening on ${port}`);
  });
}

const entry = process.argv[1]?.replaceAll("\\", "/");
if (entry?.endsWith("cabinet-proxy-server.ts")) {
  startCabinetProxy();
}
