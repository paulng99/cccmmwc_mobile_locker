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

export function parseAuthInput(input: string): AuthInput {
  const text = input.trim();
  if (!text) return { kind: "none" };
  try {
    const parsed = JSON.parse(text) as { sessionId?: string; web_id?: string };
    if (parsed.sessionId || parsed.web_id) return { kind: "none" };
  } catch {
    // Cookie strings are not JSON.
  }
  if (text.includes("=")) {
    return { kind: "cookie", cookie: text };
  }
  return { kind: "none" };
}

export function exportQuery(from: string, to: string): string {
  const params = new URLSearchParams({
    startTime: `${from} 00:00:00`,
    endTime: `${to} 23:59:59`,
    beginTime: `${from} 00:00:00`,
    start: from,
    end: to,
    from,
    to,
    startDate: from,
    endDate: to,
  });
  return params.toString();
}

export function candidateExportUrls(baseUrl: string, exportApiPath: string, _from?: string, _to?: string): string[] {
  const base = baseUrl.replace(/\/$/, "");
  const paths = [exportApiPath, "/Logs/OpenLog/ExportExcel"]
    .map((path) => path.trim())
    .filter(Boolean);
  const unique = [...new Set(paths)];
  return unique.map((path) => {
    const prefix = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
    return prefix.includes("?") ? prefix : `${prefix}?1=1`;
  });
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
  const auth = parseAuthInput(options.sessionInput);
  const urls = candidateExportUrls(options.baseUrl, options.exportApiPath, options.from, options.to);
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
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: "",
        cache: "no-store",
      });
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
      if (lastError.name === "TypeError" || lastError.message.includes("Failed to fetch")) {
        throw Object.assign(new Error("cors_or_network"), { cause: lastError });
      }
    }
  }
  throw lastError ?? new Error("export_failed");
}
