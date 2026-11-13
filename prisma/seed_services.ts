import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    name: 'Painting',
    slug: 'painting',
    description: 'Interior and exterior painting',
    sortOrder: 0,
    services: [
      {
        name: 'Painting',
        slug: 'painting',
        shortDescription: 'Interior & exterior painting',
        description: 'Wall painting for rooms, exteriors, and touch-ups. The quote confirms materials and area.',
        mrp: '4999.00',
        sellingPrice: '3999.00',
        sortOrder: 0,
      },
      {
        name: 'Interior room painting',
        slug: 'interior-room-painting',
        shortDescription: 'Single-room interior painting',
        description: 'A smaller interior painting job. Final price depends on wall condition and paint choice.',
        mrp: '2999.00',
        sellingPrice: '2499.00',
        sortOrder: 1,
      },
    ],
  },
  {
    name: 'Electrical',
    slug: 'electrical',
    description: 'Wiring, lights, fans and more',
    sortOrder: 10,
    services: [
      {
        name: 'Electrical',
        slug: 'electrical',
        shortDescription: 'Wiring, lights, fans & more',
        description: 'Electrical repairs and installations. A site visit confirms the work.',
        mrp: '1499.00',
        sellingPrice: '1299.00',
        sortOrder: 0,
      },
    ],
  },
  {
    name: 'Plumbing',
    slug: 'plumbing',
    description: 'Repairs, fittings and installations',
    sortOrder: 20,
    services: [
      {
        name: 'Plumbing',
        slug: 'plumbing',
        shortDescription: 'Repairs, fittings & installations',
        description: 'Leak repairs, fittings, and installations.',
        mrp: '999.00',
        sellingPrice: '899.00',
        sortOrder: 0,
      },
    ],
  },
  {
    name: 'Tiling & Flooring',
    slug: 'tiling',
    description: 'Tile work, floor repairs and more',
    sortOrder: 30,
    services: [
      {
        name: 'Tiling & Flooring',
        slug: 'tiling',
        shortDescription: 'Tile work, floor repairs & more',
        description: 'Tile laying and floor repairs.',
        mrp: '3499.00',
        sellingPrice: '2999.00',
        sortOrder: 0,
      },
    ],
  },
  {
    name: 'Carpentry',
    slug: 'carpentry',
    description: 'Doors, cabinets and wood work',
    sortOrder: 40,
    services: [
      {
        name: 'Carpentry',
        slug: 'carpentry',
        shortDescription: 'Doors, cabinets & wood work',
        description: 'Doors, cabinets, and other wood work.',
        mrp: '2499.00',
        sellingPrice: '1999.00',
        sortOrder: 0,
      },
    ],
  },
  {
    name: 'Waterproofing',
    slug: 'waterproofing',
    description: 'Terrace, bathroom and wall waterproofing',
    sortOrder: 45,
    services: [],
  },
  {
    name: 'Other Services',
    slug: 'other',
    description: 'False ceiling, sealing and more',
    sortOrder: 50,
    services: [
      {
        name: 'Other Services',
        slug: 'other',
        shortDescription: 'False ceiling, sealing & more',
        description: 'Other home repairs discussed in the estimate.',
        mrp: '1999.00',
        sellingPrice: '1999.00',
        sortOrder: 0,
      },
    ],
  },
] as const;

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  for (const category of categories) {
    const saved = await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true,
        isFeatured: category.slug === "painting",
      },
    });
    for (const service of category.services) {
      const existing = await prisma.service.findUnique({ where: { slug: service.slug }, select: { id: true } });
      if (existing) continue;
      await prisma.service.create({
        data: {
          categoryId: saved.id,
          name: service.name,
          slug: service.slug,
          shortDescription: service.shortDescription,
          description: service.description,
          mrp: service.mrp,
          sellingPrice: service.sellingPrice,
          sortOrder: service.sortOrder,
          isActive: true,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Service seed failed');
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
