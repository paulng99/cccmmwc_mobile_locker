const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("000000", 10);
  await prisma.user.upsert({
    where: { loginName: "admin" },
    update: { passwordHash, role: "admin" },
    create: { loginName: "admin", passwordHash, role: "admin" },
  });
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  await prisma.syncState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
