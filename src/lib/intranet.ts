export type SessionPayload = {
  sessionId: string;
  timestamp: number;
};

export type AuthInput = { kind: "none" } | { kind: "cookie"; cookie: string };

export function normalizeSessionPayload(input: string): SessionPayload | null {
  const text = input.trim();
  if (!text) return null;
  if (/^[0-9a-f-]{36}$/i.test(text)) {
    return { sessionId: text, timestamp: Date.now() };
  }
  try {
    const parsed = JSON.parse(text) as { sessionId?: string; timestamp?: number };
    if (!parsed.sessionId) return null;
    return {
      sessionId: parsed.sessionId,
      timestamp: parsed.timestamp ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function extractCookieHeader(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const headerMatch = text.match(/^cookie:\s*(.+)$/im);
  if (headerMatch?.[1]) {
    return headerMatch[1].trim();
  }
  if (/^GET |^POST |^HTTP\//m.test(text)) {
    return null;
  }
  if (text.includes("=") && !text.startsWith("{")) {
    return text;
  }
  return null;
}

export function parseAuthInput(input: string): AuthInput {
  const text = input.trim();
  if (!text) return { kind: "none" };
  try {
    const parsed = JSON.parse(text) as { sessionId?: string; web_id?: string };
    if (parsed.sessionId || parsed.web_id) return { kind: "none" };
  } catch {
    // Cookie strings are not JSON.
  }
  const cookie = extractCookieHeader(text);
  if (cookie) {
    return { kind: "cookie", cookie };
  }
  return { kind: "none" };
}

function withDayBound(value: string, bound: "start" | "end"): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return bound === "start" ? `${trimmed} 00:00:00` : `${trimmed} 23:59:59`;
  }
  return trimmed;
}

export function exportQuery(from: string, to: string): string {
  const start = withDayBound(from, "start");
  const end = withDayBound(to, "end");
  const params = new URLSearchParams({
    startTime: start,
    endTime: end,
    beginTime: start,
    start,
    end,
    from: start,
    to: end,
    startDate: start,
    endDate: end,
    "Searcher.OpenDate": `${start} ~ ${end}`,
    "Searcher.StartTime": start,
    "Searcher.EndTime": end,
    "Searcher.startTime": start,
    "Searcher.endTime": end,
    "Searcher.OpenTime": `${start} ~ ${end}`,
    OpenTime: `${start} ~ ${end}`,
    "OpenTime[0]": start,
    "OpenTime[1]": end,
    "Searcher.OpenTime[0]": start,
    "Searcher.OpenTime[1]": end,
  });
  return params.toString();
}

export function candidateExportUrls(baseUrl: string, exportApiPath: string, _from?: string, _to?: string): string[] {
  return absoluteExportUrls(baseUrl, [exportApiPath, "/Logs/OpenLog/ExportExcel"]);
}

export function candidateFrpUserExportUrls(baseUrl: string): string[] {
  return absoluteExportUrls(baseUrl, ["/Users/FRPUser/ExportExcel"]);
}

function absoluteExportUrls(baseUrl: string, paths: string[]): string[] {
  const base = baseUrl.replace(/\/$/, "");
  const unique = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  return unique.map((path) => {
    const prefix = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
    return prefix.includes("?") ? prefix : `${prefix}?1=1`;
  });
}

export async function probeIntranet(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(baseUrl, { mode: "no-cors", cache: "no-store", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeLoginHtml(buffer: ArrayBuffer, contentType: string): boolean {
  const text = new TextDecoder("utf-8").decode(buffer.slice(0, 400));
  return (
    contentType.includes("html") ||
    /Login\/Login|<script>var redirect=/i.test(text)
  );
}

function looksLikeExcel(buffer: ArrayBuffer, contentType: string): boolean {
  if (contentType.includes("excel") || contentType.includes("spreadsheet") || contentType.includes("octet-stream")) {
    return buffer.byteLength > 64;
  }
  const bytes = new Uint8Array(buffer.slice(0, 4));
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function fetchExcelFromIntranet(options: {
  baseUrl: string;
  exportApiPath: string;
  storageKey: string;
  sessionInput: string;
  from: string;
  to: string;
}): Promise<ArrayBuffer> {
  return fetchExcelFromUrls(
    candidateExportUrls(options.baseUrl, options.exportApiPath, options.from, options.to),
    options.sessionInput,
    exportQuery(options.from, options.to),
  );
}

export async function fetchFrpUserExcelFromIntranet(options: {
  baseUrl: string;
  sessionInput: string;
}): Promise<ArrayBuffer> {
  return fetchExcelFromUrls(candidateFrpUserExportUrls(options.baseUrl), options.sessionInput);
}

async function fetchExcelFromUrls(urls: string[], sessionInput: string, body = ""): Promise<ArrayBuffer> {
  const auth = parseAuthInput(sessionInput);
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      };
      if (auth.kind === "cookie") {
        headers.Cookie = auth.cookie;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body,
        cache: "no-store",
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!response.ok) {
        lastError = new Error(`export_http_${response.status}`);
        continue;
      }
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") ?? "";
      if (looksLikeLoginHtml(buffer, contentType)) {
        lastError = new Error("need_locker_login");
        continue;
      }
      if (!looksLikeExcel(buffer, contentType)) {
        lastError = new Error("export_not_excel");
        continue;
      }
      return buffer;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("export_failed");
      if (
        lastError.name === "TypeError" ||
        lastError.name === "AbortError" ||
        lastError.message.includes("Failed to fetch")
      ) {
        throw Object.assign(new Error("cors_or_network"), { cause: lastError });
      }
    }
  }
  throw lastError ?? new Error("export_failed");
}
