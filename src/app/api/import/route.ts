import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { parseOpenLogWorkbook } from "@/lib/parse-workbook";
import { importOpenLogRows } from "@/lib/import-rows";

export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseOpenLogWorkbook(buffer);
  const result = await importOpenLogRows(parsed.rows, "browser_upload");
  return NextResponse.json({ ok: true, ...result, skipped: parsed.skipped });
}
