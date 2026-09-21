import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseOpenLogWorkbook } from "@/lib/parse-workbook";
import { importOpenLogRows, recordSyncError } from "@/lib/import-rows";
import { fetchExcelFromIntranet } from "@/lib/intranet";
import { resolveExportRange, type ExportRangeMode } from "@/lib/open-log";

function asRangeMode(value: unknown): ExportRangeMode {
  return value === "full" ? "full" : "sinceLast";
}

export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const [settings, sync] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.syncState.findUnique({ where: { id: 1 } }),
  ]);
  if (!settings) {
    await recordSyncError("missing_settings");
    return NextResponse.json({ ok: false, error: "missing_settings" }, { status: 400 });
  }
  let mode: ExportRangeMode = sync?.lastSuccessAt ? "sinceLast" : "full";
  let requestedFrom: string | undefined;
  let requestedTo: string | undefined;
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text) as { mode?: unknown; from?: unknown; to?: unknown };
      mode = asRangeMode(body.mode ?? mode);
      if (typeof body.from === "string" && body.from.trim()) requestedFrom = body.from.trim();
      if (typeof body.to === "string" && body.to.trim()) requestedTo = body.to.trim();
    }
  } catch {
    mode = sync?.lastSuccessAt ? "sinceLast" : "full";
  }
  const computed = resolveExportRange({
    mode,
    lastSuccessAt: sync?.lastSuccessAt ?? null,
    lastSuccessOpenDate: sync?.lastSuccessOpenDate ?? null,
    firstImportDate: settings.firstImportDate,
  });
  const from = requestedFrom ?? computed.from;
  const to = requestedTo ?? computed.to;
  try {
    const excel = await fetchExcelFromIntranet({
      baseUrl: settings.intranetBaseUrl,
      exportApiPath: settings.exportApiPath,
      storageKey: settings.sessionStorageKey,
      sessionInput: settings.sessionPayload,
      from,
      to,
    });
    const parsed = await parseOpenLogWorkbook(Buffer.from(excel));
    const result = await importOpenLogRows(parsed.rows, "browser_fetch");
    return NextResponse.json({ ok: true, via: "proxy", ...result, skipped: parsed.skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxyFail";
    await recordSyncError(message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
