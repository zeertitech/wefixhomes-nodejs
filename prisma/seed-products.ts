import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.development') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const categories = [
  { name: 'Men', slug: 'men', description: 'Premium menswear' },
  { name: 'Women', slug: 'women', description: 'Elegant womenswear' },
  { name: 'Accessories', slug: 'accessories', description: 'Luxury accessories' },
  { name: 'Kids', slug: 'kids', description: 'Designer kids clothing' },
];

const subCategories = {
  men: [
    { name: 'T-Shirts', slug: 'men-tshirts' },
    { name: 'Shirts', slug: 'men-shirts' },
    { name: 'Pants', slug: 'men-pants' },
    { name: 'Outerwear', slug: 'men-outerwear' },
  ],
  women: [
    { name: 'Dresses', slug: 'women-dresses' },
    { name: 'Tops', slug: 'women-tops' },
    { name: 'Skirts', slug: 'women-skirts' },
    { name: 'Handbags', slug: 'women-handbags' },
  ],
  accessories: [
    { name: 'Watches', slug: 'watches' },
    { name: 'Sunglasses', slug: 'sunglasses' },
    { name: 'Belts', slug: 'belts' },
  ],
  kids: [
    { name: 'Boys', slug: 'kids-boys' },
    { name: 'Girls', slug: 'kids-girls' },
  ],
};

const productsBase = [
  { name: 'Oversized Tee', basePrice: 1299, cat: 'men-tshirts' },
  { name: 'Oxford Shirt', basePrice: 2499, cat: 'men-shirts' },
  { name: 'Slim Chinos', basePrice: 1899, cat: 'men-pants' },
  { name: 'Biker Jacket', basePrice: 8999, cat: 'men-outerwear' },
  { name: 'Summer Dress', basePrice: 3499, cat: 'women-dresses' },
  { name: 'Silk Blouse', basePrice: 2799, cat: 'women-tops' },
  { name: 'Midi Skirt', basePrice: 2199, cat: 'women-skirts' },
  { name: 'Crossbody Bag', basePrice: 4599, cat: 'women-handbags' },
  { name: 'Silver Watch', basePrice: 12500, cat: 'watches' },
  { name: 'Aviator Shades', basePrice: 3200, cat: 'sunglasses' },
  { name: 'Denim Overalls', basePrice: 1599, cat: 'kids-boys' },
  { name: 'Party Dress', basePrice: 2299, cat: 'kids-girls' },
  { name: 'Graphic Hoodie', basePrice: 2999, cat: 'men-tshirts' },
  { name: 'Linen Shirt', basePrice: 2199, cat: 'men-shirts' },
  { name: 'Cargo Pants', basePrice: 2599, cat: 'men-pants' },
  { name: 'Denim Jacket', basePrice: 3599, cat: 'men-outerwear' },
  { name: 'Maxi Dress', basePrice: 4299, cat: 'women-dresses' },
  { name: 'Camisole Top', basePrice: 1499, cat: 'women-tops' },
  { name: 'Mini Skirt', basePrice: 1899, cat: 'women-skirts' },
  { name: 'Leather Tote', basePrice: 6999, cat: 'women-handbags' },
];

const adjs = ['Essential', 'Premium', 'Luxury', 'Classic', 'Modern', 'Urban', 'Vintage', 'Signature', 'Elite', 'Eco'];
const materials = ['Cotton', 'Silk', 'Leather', 'Linen', 'Wool', 'Denim', 'Suede', 'Velvet'];

const IMAGE_URLS = [
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d',
  'https://images.unsplash.com/photo-1558769132-cb1aea458c5e',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae',
  'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3',
  'https://images.unsplash.com/photo-1581044777072-4763240bdfdd',
  'https://images.unsplash.com/photo-1479064555552-3ef4979f8908',
  'https://images.unsplash.com/photo-1445205174225-4511f2217522',
  'https://images.unsplash.com/photo-1511499767350-a1590fdb7358',
  'https://images.unsplash.com/photo-1523381210434-271e8be1f52b',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',
];

async function main() {
  console.log('🌱 Starting extended product seeding (50 varieties)...');

  // 1. Ensure Attributes exist
  const sizeAttr = await prisma.attribute.upsert({
    where: { name: 'Size' },
    update: {},
    create: {
      name: 'Size',
      values: {
        create: [{ value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' }],
      },
    },
    include: { values: true },
  });

  const colorAttr = await prisma.attribute.upsert({
    where: { name: 'Color' },
    update: {},
    create: {
      name: 'Color',
      values: {
        create: [
          { value: 'Black' },
          { value: 'White' },
          { value: 'Navy' },
          { value: 'Beige' },
          { value: 'Emerald' },
          { value: 'Burgundy' },
          { value: 'Slate' }
        ],
      },
    },
    include: { values: true },
  });

  const sizes = sizeAttr.values;
  const colors = colorAttr.values;

  console.log('✅ Attributes ready');

  // 2. Create Categories
  const catMap: Record<string, string> = {};

  for (const cat of categories) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug, description: cat.description },
    });
    catMap[cat.slug] = parent.id;

    if (subCategories[cat.slug as keyof typeof subCategories]) {
      for (const sub of subCategories[cat.slug as keyof typeof subCategories]) {
        const child = await prisma.category.upsert({
          where: { slug: sub.slug },
          update: {},
          create: { name: sub.name, slug: sub.slug, parentId: parent.id },
        });
        catMap[sub.slug] = child.id;
      }
    }
  }

  console.log('✅ Categories ready');

  // 3. Generate 50 products
  for (let i = 0; i < 50; i++) {
    const base = productsBase[i % productsBase.length];
    const adj = adjs[Math.floor(i / productsBase.length) % adjs.length];
    const mat = materials[i % materials.length];
    const name = `${adj} ${mat} ${base.name}`;
    const slug = slugify(name, { lower: true }) + `-${i + 100}`;
    const price = base.basePrice + (Math.floor(Math.random() * 20) * 50);

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        basePrice: price,
        categoryId: catMap[base.cat],
        description: `Experience the ultimate comfort and style with our ${name}. Crafted from high-quality ${mat.toLowerCase()} for a premium feel. Perfect for any occasion.`,
        isActive: true,
        isFeatured: Math.random() > 0.7,
        taxRate: 5,
        keywords: [adj.toLowerCase(), mat.toLowerCase(), base.name.toLowerCase(), 'luxury', 'shanandra'],
        images: {
          create: [
            {
              url: `${IMAGE_URLS[i % IMAGE_URLS.length]}?auto=format&fit=crop&q=80&w=1200`,
              altText: name,
              isPrimary: true,
              sortOrder: 0
            },
            {
                url: `${IMAGE_URLS[(i + 1) % IMAGE_URLS.length]}?auto=format&fit=crop&q=80&w=1200`,
                altText: `${name} View 2`,
                isPrimary: false,
                sortOrder: 1
              }
          ]
        }
      }
    });

    // Create 2-3 variants for each product
    const variantCount = 2 + Math.floor(Math.random() * 2);
    for (let j = 0; j < variantCount; j++) {
      const size = sizes[j % sizes.length];
      const color = colors[(i + j) % colors.length];
      const sku = `${slug.substring(0, 15).toUpperCase()}-${size.value}-${color.value.substring(0, 3).toUpperCase()}`;

      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku,
          price: price,
          comparePrice: price + 500,
          isActive: true,
          inventory: {
            create: {
              quantity: 20 + Math.floor(Math.random() * 80)
            }
          }
        }
      });

      // Link attributes
      await prisma.variantAttribute.createMany({
        data: [
          { variantId: variant.id, attributeValueId: size.id },
          { variantId: variant.id, attributeValueId: color.id }
        ]
      });
    }

    if ((i + 1) % 10 === 0) {
      console.log(`⏳ Progress: ${i + 1}/50 products created...`);
    }
  }

  console.log('\n🎉 Successfully seeded 50 product varieties with variants and inventory!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
