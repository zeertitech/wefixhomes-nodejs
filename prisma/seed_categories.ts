import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.development') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface SubCategorySeed {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  metaTitle?: string;
}

interface ParentCategorySeed {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  metaTitle?: string;
  subcategories: SubCategorySeed[];
}

const CATEGORIES_DATA: ParentCategorySeed[] = [
  {
    name: 'Women',
    slug: 'womens-wear',
    metaTitle: 'FOR EVERY YOU',
    description: 'Elegant and contemporary styles, crafted for every occasion — from everyday grace to special celebrations.',
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=85',
    sortOrder: 1,
    subcategories: [
      {
        name: 'Sarees',
        slug: 'sarees',
        metaTitle: 'Grace in every drape',
        description: 'Grace in every drape',
        imageUrl: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80',
        sortOrder: 1,
      },
      {
        name: 'Lehengas',
        slug: 'lehengas',
        metaTitle: 'For your special moments',
        description: 'For your special moments',
        imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
        sortOrder: 2,
      },
      {
        name: 'Salwars & Suits',
        slug: 'salwars-suits',
        metaTitle: 'Everyday to elegant',
        description: 'Everyday to elegant',
        imageUrl: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80',
        sortOrder: 3,
      },
      {
        name: 'Indo Western',
        slug: 'indo-western',
        metaTitle: 'Contemporary charm',
        description: 'Contemporary charm',
        imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
        sortOrder: 4,
      },
      {
        name: 'Blouses',
        slug: 'blouses',
        metaTitle: 'Mix, match & style',
        description: 'Mix, match & style',
        imageUrl: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=800&q=80',
        sortOrder: 5,
      },
    ],
  },
  {
    name: 'Men',
    slug: 'mens-wear',
    metaTitle: 'TIMELESS STYLE',
    description: 'Modern ethnic and casuals, designed for comfort, confidence and every occasion.',
    imageUrl: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&w=1000&q=85',
    sortOrder: 2,
    subcategories: [
      {
        name: 'Kurtas',
        slug: 'kurtas',
        metaTitle: 'Tradition meets style',
        description: 'Tradition meets style',
        imageUrl: 'https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?auto=format&fit=crop&w=800&q=80',
        sortOrder: 1,
      },
      {
        name: 'Sherwanis',
        slug: 'sherwanis',
        metaTitle: 'For grand occasions',
        description: 'For grand occasions',
        imageUrl: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=800&q=80',
        sortOrder: 2,
      },
      {
        name: 'Shirts',
        slug: 'shirts',
        metaTitle: 'Smart everyday wear',
        description: 'Smart everyday wear',
        imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
        sortOrder: 3,
      },
      {
        name: 'Dhoti Sets',
        slug: 'dhoti-sets',
        metaTitle: 'Classic comfort',
        description: 'Classic comfort',
        imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
        sortOrder: 4,
      },
      {
        name: 'Jackets & Waistcoats',
        slug: 'jackets-waistcoats',
        metaTitle: 'Royal layer',
        description: 'Royal layer',
        imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
        sortOrder: 5,
      },
    ],
  },
  {
    name: 'Kids',
    slug: 'kids-festive',
    metaTitle: 'LITTLE MOMENTS',
    description: 'Adorable and comfortable outfits for their happiest days, made with love and care.',
    imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1000&q=85',
    sortOrder: 3,
    subcategories: [
      {
        name: 'Girls Ethnic',
        slug: 'girls-ethnic',
        metaTitle: 'Colorful moments',
        description: 'Colorful moments',
        imageUrl: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=800&q=80',
        sortOrder: 1,
      },
      {
        name: 'Boys Ethnic',
        slug: 'boys-ethnic',
        metaTitle: 'Tradition for tomorrow',
        description: 'Tradition for tomorrow',
        imageUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=800&q=80',
        sortOrder: 2,
      },
      {
        name: 'Girls Party Wear',
        slug: 'girls-party-wear',
        metaTitle: 'For every celebration',
        description: 'For every celebration',
        imageUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80',
        sortOrder: 3,
      },
      {
        name: 'Boys Party Wear',
        slug: 'boys-party-wear',
        metaTitle: 'Dress to impress',
        description: 'Dress to impress',
        imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
        sortOrder: 4,
      },
      {
        name: 'Kids Sets',
        slug: 'kids-sets',
        metaTitle: 'Playful ease',
        description: 'Playful ease',
        imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80',
        sortOrder: 5,
      },
    ],
  },
  {
    name: 'Bridal & Trousseau',
    slug: 'bridal-trousseau',
    metaTitle: 'ROYAL CELEBRATIONS',
    description: 'Curated bridal and groom suites designed for unforgettable wedding celebrations.',
    imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    sortOrder: 4,
    subcategories: [
      {
        name: 'Bridal Red Lehengas',
        slug: 'bridal-red-lehengas',
        metaTitle: 'Royal scarlet',
        description: 'Classic crimson and vermillion heritage wedding lehengas with real gold gota.',
        imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
        sortOrder: 1,
      },
      {
        name: "Groom's Trousseau",
        slug: 'grooms-trousseau',
        metaTitle: 'Ceremonial regalia',
        description: 'Coordinated turbans, stoles, and ceremonial regalia for the royal groom.',
        imageUrl: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&w=800&q=80',
        sortOrder: 2,
      },
      {
        name: 'Haldi & Mehendi Ensembles',
        slug: 'haldi-mehendi',
        metaTitle: 'Festive hues',
        description: 'Joyful sun-yellow kurtas, leheriya skirts, and mirror-work lightweight outfits.',
        imageUrl: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80',
        sortOrder: 3,
      },
      {
        name: 'Sangeet & Cocktail Glitz',
        slug: 'sangeet-cocktail',
        metaTitle: 'Evening glamour',
        description: 'Dazzling sequin sarees, metallic lehengas, and tuxedo-inspired sherwanis.',
        imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
        sortOrder: 4,
      },
      {
        name: 'Reception Couture',
        slug: 'reception-couture',
        metaTitle: 'Contemporary majesty',
        description: 'Contemporary velvet silhouettes, pastel gowns, and modern tailored bandhgalas.',
        imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
        sortOrder: 5,
      },
    ],
  },
  {
    name: 'Artisan Accessories & Accents',
    slug: 'artisan-accessories',
    metaTitle: 'HEIRLOOM ACCENTS',
    description: 'Hand-embroidered mojaris, velvet potlis, royal safas, and heirloom accents.',
    imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
    sortOrder: 5,
    subcategories: [
      {
        name: 'Velvet & Pearl Potlis',
        slug: 'velvet-potlis-clutches',
        metaTitle: 'Evening keepsakes',
        description: 'Zardozi embroidered evening clutches and tasselled drawstring potlis.',
        imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
        sortOrder: 1,
      },
      {
        name: 'Handcrafted Mojaris & Juttis',
        slug: 'handcrafted-mojaris',
        metaTitle: 'Royal footwear',
        description: 'Pure leather juttis adorned with dabka, sequins, and threadwork.',
        imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
        sortOrder: 2,
      },
      {
        name: 'Royal Safas & Turbans',
        slug: 'royal-safas-turbans',
        metaTitle: 'Crowning glory',
        description: 'Chanderi silk wedding safas, kalgi brooches, and festive groom pagris.',
        imageUrl: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&w=800&q=80',
        sortOrder: 3,
      },
      {
        name: 'Heritage Brooches & Kilangis',
        slug: 'heritage-brooches-kilangis',
        metaTitle: 'Kundan elegance',
        description: 'Antique finish kundan brooches, pocket pins, and ceremonial jewellery.',
        imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
        sortOrder: 4,
      },
      {
        name: 'Embellished Kamarbands & Belts',
        slug: 'embellished-kamarbands',
        metaTitle: 'Waist accents',
        description: 'Saree belts and sherwani cummerbunds to accentuate ethnic drape lines.',
        imageUrl: 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=800&q=80',
        sortOrder: 5,
      },
    ],
  },
];

async function seedCategories() {
  console.log('🌟 Seeding 5 Parent Categories and 5 Subcategories each...\n');

  for (const parentData of CATEGORIES_DATA) {
    const parent = await prisma.category.upsert({
      where: { slug: parentData.slug },
      update: {
        name: parentData.name,
        description: parentData.description,
        imageUrl: parentData.imageUrl,
        sortOrder: parentData.sortOrder,
        metaTitle: parentData.metaTitle ?? null,
        isActive: true,
        parentId: null,
      },
      create: {
        name: parentData.name,
        slug: parentData.slug,
        description: parentData.description,
        imageUrl: parentData.imageUrl,
        sortOrder: parentData.sortOrder,
        metaTitle: parentData.metaTitle ?? null,
        isActive: true,
        parentId: null,
      },
    });

    console.log(`📁 Parent Category: [${parent.name}] (slug: ${parent.slug})`);

    for (const sub of parentData.subcategories) {
      const subCat = await prisma.category.upsert({
        where: { slug: sub.slug },
        update: {
          name: sub.name,
          description: sub.description,
          imageUrl: sub.imageUrl,
          sortOrder: sub.sortOrder,
          metaTitle: sub.metaTitle ?? null,
          isActive: true,
          parentId: parent.id,
        },
        create: {
          name: sub.name,
          slug: sub.slug,
          description: sub.description,
          imageUrl: sub.imageUrl,
          sortOrder: sub.sortOrder,
          metaTitle: sub.metaTitle ?? null,
          isActive: true,
          parentId: parent.id,
        },
      });

      console.log(`   ↳ Subcategory: ${subCat.name} (slug: ${subCat.slug})`);
    }

    console.log(`   ✓ Seeded ${parentData.subcategories.length} subcategories under ${parent.name}\n`);
  }

  console.log('🎉 Successfully seeded Categories!');
}

seedCategories()
  .catch((e) => {
    console.error('❌ Error seeding categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
