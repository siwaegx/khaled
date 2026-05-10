import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = "k.shwdfy@gmail.com";
  const password = "1111";
  const name = "Platform Admin";

  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, isAdmin: true, name },
    create: { email, passwordHash: hash, name, isAdmin: true },
  });

  console.log(`✓ Admin user ready: ${user.email}`);
  console.log(`  Password: ${password}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
