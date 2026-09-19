import { PrismaClient } from "@prisma/client";

const PRISMA_SCHEMA_ID = "locker_assignments_v1";
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaId?: string;
};

function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

if (globalForPrisma.prisma && globalForPrisma.prismaSchemaId !== PRISMA_SCHEMA_ID) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaId = PRISMA_SCHEMA_ID;
}

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
