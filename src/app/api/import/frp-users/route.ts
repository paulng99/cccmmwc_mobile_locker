import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { parseFrpUserWorkbook } from "@/lib/parse-workbook";
import { importLockerAssignments } from "@/lib/import-rows";

export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFrpUserWorkbook(buffer);
    const result = await importLockerAssignments(parsed.rows);
    return NextResponse.json({ ok: true, ...result, skipped: parsed.skipped });
  } catch {
    return NextResponse.json({ ok: false, error: "excel_headers_mismatch" }, { status: 400 });
  }
}
