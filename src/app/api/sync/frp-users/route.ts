import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseFrpUserWorkbook } from "@/lib/parse-workbook";
import { importLockerAssignments } from "@/lib/import-rows";
import { fetchFrpUserExcelFromIntranet } from "@/lib/intranet";

export async function POST() {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    return NextResponse.json({ ok: false, error: "missing_settings" }, { status: 400 });
  }
  try {
    const excel = await fetchFrpUserExcelFromIntranet({
      baseUrl: settings.intranetBaseUrl,
      sessionInput: settings.sessionPayload,
    });
    const parsed = await parseFrpUserWorkbook(Buffer.from(excel));
    const result = await importLockerAssignments(parsed.rows);
    return NextResponse.json({ ok: true, via: "proxy", ...result, skipped: parsed.skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxyFail";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
