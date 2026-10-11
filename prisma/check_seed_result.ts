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

async function verify() {
  const sampleGroup = await prisma.productGroup.findFirst({
    where: { category: { slug: 'sarees' } },
    include: {
      category: true,
      products: {
        include: {
          color: true,
          images: true,
          variants: {
            include: { size: true, inventory: true },
            orderBy: { price: 'asc' },
          },
        },
      },
    },
  });

  console.log('Sample Product Group:', sampleGroup?.name, `(Category: ${sampleGroup?.category.name})`);
  console.log('Colors count:', sampleGroup?.products.length);
  for (const p of sampleGroup?.products || []) {
    console.log(`\n  Color Product: ${p.name}`);
    console.log(`  - Color: ${p.color.value}`);
    console.log(`  - Primary: ${p.isPrimary}`);
    console.log(`  - Images (${p.images.length}):`, p.images.map(img => img.altText).join(' | '));
    console.log(`  - Variants with prices:`);
    for (const v of p.variants) {
      console.log(`    * Size ${v.size.value}: Price ₹${v.price} (Compare: ₹${v.comparePrice}), SKU: ${v.sku}, Stock: ${v.inventory?.quantity}`);
    }
  }
}

verify()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
