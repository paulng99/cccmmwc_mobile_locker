export type SessionPayload = {
  sessionId: string;
  timestamp: number;
};

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

export function candidateExportUrls(baseUrl: string, exportApiPath: string, from: string, to: string): string[] {
  const base = baseUrl.replace(/\/$/, "");
  const query = exportQuery(from, to);
  const paths = [
    exportApiPath,
    "/api/Logs/OpenLog/Export",
    "/api/Logs/OpenLog/export",
    "/api/openLog/export",
    "/api/OpenLog/Export",
    "/Logs/OpenLog/Export",
  ]
    .map((path) => path.trim())
    .filter(Boolean);
  const unique = [...new Set(paths)];
  return unique.map((path) => {
    const prefix = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const joiner = prefix.includes("?") ? "&" : "?";
    return `${prefix}${joiner}${query}`;
  });
}

export function authHeaders(storageKey: string, payload: SessionPayload): HeadersInit {
  const json = JSON.stringify(payload);
  return {
    Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*",
    Cookie: `${storageKey}=${encodeURIComponent(json)}`,
    sessionId: payload.sessionId,
    "X-Session-Id": payload.sessionId,
    Authorization: `Bearer ${payload.sessionId}`,
  };
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
  const payload = normalizeSessionPayload(options.sessionInput);
  if (!payload) {
    throw new Error("missing_session");
  }
  const urls = candidateExportUrls(options.baseUrl, options.exportApiPath, options.from, options.to);
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: authHeaders(options.storageKey, payload),
        cache: "no-store",
      });
      if (!response.ok) {
        lastError = new Error(`export_http_${response.status}`);
        continue;
      }
      const buffer = await response.arrayBuffer();
      if (!looksLikeExcel(buffer, response.headers.get("content-type") ?? "")) {
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
