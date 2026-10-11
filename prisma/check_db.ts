import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    include: { children: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('Top level categories:');
  for (const c of categories) {
    console.log(`- ${c.name} (${c.slug}, id: ${c.id}):`);
    for (const sub of c.children) {
      console.log(`   * ${sub.name} (${sub.slug}, id: ${sub.id})`);
    }
  }

  const attrs = await prisma.attribute.findMany({ include: { values: true } });
  console.log('\nAttributes:');
  for (const a of attrs) {
    console.log(`- ${a.name}: ${a.values.map(v => v.value).join(', ')}`);
  }

  const productCount = await prisma.product.count();
  const groupCount = await prisma.productGroup.count();
  console.log(`\nTotal product groups: ${groupCount}, products: ${productCount}`);
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
