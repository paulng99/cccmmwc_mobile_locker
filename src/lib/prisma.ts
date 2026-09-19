import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function readUnusedStudentNos(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ unused_student_nos: string }>>`
    SELECT unused_student_nos FROM app_settings WHERE id = 1
  `;
  return rows[0]?.unused_student_nos ?? "";
}

export async function writeUnusedStudentNos(text: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE app_settings SET unused_student_nos = ${text} WHERE id = 1
  `;
}
