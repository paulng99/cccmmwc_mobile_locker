import { NextResponse } from "next/server";
import { prisma, readUnusedStudentNos, writeUnusedStudentNos } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { overlapFromDate, hkToday } from "@/lib/open-log";
import { recomputeCurrentState } from "@/lib/import-rows";

export async function GET() {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const [settings, sync] = await Promise.all([
    prisma.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.syncState.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  ]);
  const from = overlapFromDate(sync.lastSuccessOpenDate, settings.firstImportDate);
  return NextResponse.json({
    intranetBaseUrl: settings.intranetBaseUrl,
    sessionStorageKey: settings.sessionStorageKey,
    hasSession: Boolean(settings.sessionPayload),
    sessionPayload: settings.sessionPayload,
    exportApiPath: settings.exportApiPath,
    firstImportDate: settings.firstImportDate,
    doorsPerCabinet: settings.doorsPerCabinet,
    unusedStudentNos: await readUnusedStudentNos(),
    lastSuccessAt: sync.lastSuccessAt,
    lastSuccessOpenDate: sync.lastSuccessOpenDate,
    lastError: sync.lastError,
    lastRowCount: sync.lastRowCount,
    from,
    to: hkToday(),
  });
}

export async function PUT(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await request.json()) as {
    intranetBaseUrl?: string;
    sessionStorageKey?: string;
    sessionPayload?: string;
    exportApiPath?: string;
    firstImportDate?: string;
    doorsPerCabinet?: number;
    unusedStudentNos?: string;
  };
  const updated = await prisma.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {
      intranetBaseUrl: body.intranetBaseUrl?.trim() || undefined,
      sessionStorageKey: body.sessionStorageKey?.trim() || undefined,
      sessionPayload: body.sessionPayload !== undefined ? body.sessionPayload : undefined,
      exportApiPath: body.exportApiPath !== undefined ? body.exportApiPath : undefined,
      firstImportDate: body.firstImportDate?.trim() || undefined,
      doorsPerCabinet: body.doorsPerCabinet,
    },
  });
  if (body.unusedStudentNos !== undefined) {
    await writeUnusedStudentNos(body.unusedStudentNos);
  }
  if (body.firstImportDate !== undefined) {
    await recomputeCurrentState();
  }
  return NextResponse.json({
    ok: true,
    hasSession: Boolean(updated.sessionPayload),
  });
}
