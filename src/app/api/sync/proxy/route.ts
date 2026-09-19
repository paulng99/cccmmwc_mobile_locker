import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseOpenLogWorkbook } from "@/lib/parse-workbook";
import { importOpenLogRows, recordSyncError } from "@/lib/import-rows";
import { fetchExcelFromIntranet } from "@/lib/intranet";
import { overlapFromDate, hkToday } from "@/lib/open-log";

export async function POST() {
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
  const from = overlapFromDate(sync?.lastSuccessOpenDate ?? null, settings.firstImportDate);
  const to = hkToday();
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
