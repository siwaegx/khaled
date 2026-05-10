import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "k.shwdfy@gmail.com";
  const password = "Admin@360";
  const name = "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { email }, data: { passwordHash: hash, isAdmin: true } });
    console.log("User already exists — password reset to:", password);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, passwordHash, isAdmin: true },
    });

    const org = await prisma.organization.create({
      data: { name: "Business360", status: "active", plan: "pro" },
    });

    await prisma.orgMember.create({
      data: { userId: user.id, organizationId: org.id, role: "owner" },
    });

    console.log("Created admin user:", email);
    console.log("Password:", password);
    console.log("Organization:", org.name);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
