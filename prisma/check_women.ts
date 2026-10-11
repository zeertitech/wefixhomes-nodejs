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

async function checkWomen() {
  const women = await prisma.category.findUnique({
    where: { slug: 'womens-wear' },
    include: {
      children: {
        include: {
          _count: { select: { products: true, productGroups: true } }
        },
        orderBy: { sortOrder: 'asc' }
      }
    }
  });

  console.log('Women category:', women?.name, women?.slug);
  console.log('Subcategories:');
  for (const sub of women?.children || []) {
    console.log(`- ${sub.name} (slug: ${sub.slug}, id: ${sub.id}, active: ${sub.isActive}, sortOrder: ${sub.sortOrder}, products: ${sub._count.products}, groups: ${sub._count.productGroups})`);
  }
}

checkWomen()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
