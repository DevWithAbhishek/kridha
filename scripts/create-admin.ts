import "dotenv/config";

import { prisma } from "@/lib/db";
import { hashAdminPassword } from "@/lib/adminPassword";
import { AdminRole } from "@prisma/client";
//   npx tsx scripts/create-admin.ts

async function main() {
  const email = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;
  const name = process.env.ADMIN_NAME!;

  if (!email || !password || !name) {
    throw new Error("ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME required");
  }

  if (password.length < 12)
    throw new Error("Password must be at least 12 characters");

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return;
  }

  const passwordHash = await hashAdminPassword(password);
  const admin = await prisma.adminUser.create({
    data: { email, passwordHash, name, role: AdminRole.SUPER_ADMIN },
  });

  console.log("SUPER_ADMIN created:", { id: admin.id, email: admin.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
