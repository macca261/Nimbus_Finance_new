import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD } from '../src/config/env';

const prisma = new PrismaClient();

export async function seed() {
  const email = DEV_ADMIN_EMAIL.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, tier: 'pro_plus' } });
  return user;
}

if (require.main === module) {
  seed().then((u) => {
    // eslint-disable-next-line no-console
    console.log('Seeded dev user:', u.email);
    process.exit(0);
  }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed', e);
    process.exit(1);
  });
}


