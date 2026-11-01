import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const pepper = process.env.PEPPER_SECRET;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!email || !password || password.length < 12) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) are required');
  }
  if (!pepper || pepper.length < 32) {
    throw new Error('PEPPER_SECRET must be at least 32 characters');
  }

  const roles = ['ADMIN', 'STAFF', 'CUSTOMER'];
  const roleMap: Record<string, number> = {};
  for (const name of roles) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleMap[name] = role.id;
  }

  const salt = generateSalt();
  const passwordHash = await argon2.hash(password + pepper, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    salt: Buffer.from(salt, 'hex'),
  });

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      salt,
      roleId: roleMap['ADMIN'],
      isActive: true,
      emailVerified: true,
    },
    create: {
      email,
      passwordHash,
      salt,
      roleId: roleMap['ADMIN'],
      firstName: 'Admin',
      lastName: 'WeFixHomes',
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`Roles ready. Admin account ready for ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
