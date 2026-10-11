import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.development') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// High-quality curated Unsplash images for ethnic women's wear
const IMAGE_SETS: Record<string, string[][]> = {
  sarees: [
    [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1610030469668-932d0c2420a3?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1610030469854-c9c43e7c8585?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1617627143685-6453910c5c36?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1617627143789-53697e1644e5?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1583391733975-2983b6324b94?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1583391733980-87729e847c5f?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1594633312845-f48371360155?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1594633312952-4a0058b29cb2?auto=format&fit=crop&q=80&w=1200',
    ],
  ],
  lehengas: [
    [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1583391733975-2983b6324b94?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=1200',
    ],
  ],
  suits: [
    [
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=1200',
    ],
  ],
  indowestern: [
    [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1200',
    ],
  ],
  blouses: [
    [
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=1200',
    ],
    [
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
    ],
  ],
};

interface ProductDef {
  name: string;
  description: string;
  basePrice: number;
}

const PRODUCTS_PER_SUBCATEGORY: Record<string, ProductDef[]> = {
  sarees: [
    {
      name: 'Banarasi Katan Pure Silk Saree',
      description: 'Handwoven pure katan silk saree adorned with intricate floral jaal motifs and opulent antique gold zari borders.',
      basePrice: 16999,
    },
    {
      name: 'Kanjivaram Temple Border Silk Saree',
      description: 'Heirloom Kanjivaram silk saree featuring rich temple korvai borders, woven pallu, and lustrous pure silk weave.',
      basePrice: 22499,
    },
    {
      name: 'Chanderi Zari Tissue Festive Saree',
      description: 'Ethereal Chanderi tissue silk saree woven with subtle metallic threads, delicate scalloped edges, and featherlight drape.',
      basePrice: 12499,
    },
    {
      name: 'Tussar Hand-Embroidered Heritage Saree',
      description: 'Organic wild tussar silk saree finished with intricate hand-embroidered kantha stitches and royal pallu detailing.',
      basePrice: 14999,
    },
  ],
  lehengas: [
    [
      {
        name: 'Royal Zardozi Raw Silk Bridal Lehenga',
        description: 'Exquisite raw silk bridal lehenga ensemble featuring elaborate hand-done zardozi, dabka, and micro-sequin embellishments.',
        basePrice: 48999,
      },
      {
        name: 'Pastel Organza Floral Embroidered Lehenga',
        description: 'Breezy multi-panel organza lehenga crafted with resham threadwork, pearl highlights, and a lightweight scalloped dupatta.',
        basePrice: 32999,
      },
      {
        name: 'Mirror Work Georgette Festive Lehenga',
        description: 'Dazzling georgette lehenga set laden with authentic glass mirror work, thread tassels, and a structured matching blouse.',
        basePrice: 24999,
      },
      {
        name: 'Brocade Floral Weave Cocktail Lehenga',
        description: 'Modern silhouette heritage brocade lehenga paired with a contemporary corset blouse and ethereal net dupatta.',
        basePrice: 28999,
      },
    ],
  ][0],
  'salwars-suits': [
    {
      name: 'Chanderi Silk Anarkali Suit Set',
      description: 'Regal 16-kali flared Chanderi silk anarkali accented with gota patti hand embroidery, churidar, and zari organza dupatta.',
      basePrice: 11999,
    },
    {
      name: 'Pure Georgette Embroidered Sharara Set',
      description: 'Opulent short kurti and tiered flared sharara ensemble with intricate sequin badla work and scalloped net drape.',
      basePrice: 14499,
    },
    {
      name: 'Velvet Dori Work Straight Cut Suit',
      description: 'Rich silk-velvet straight kurti adorned with antique dori embroidery, tailored cigarette pants, and pure silk dupatta.',
      basePrice: 13999,
    },
    {
      name: 'Chiffon Lucknowi Chikankari Gharara Set',
      description: 'Timeless pure chiffon ensemble with handcrafted shadow-work chikankari, mukaish highlights, and pleated gharara.',
      basePrice: 16499,
    },
  ],
  'indo-western': [
    {
      name: 'Embellished Cape & Drape Skirt Set',
      description: 'Contemporary pre-pleated drape skirt paired with an embellished bustier and sheer floor-length embroidered cape.',
      basePrice: 18999,
    },
    {
      name: 'Contemporary Peplum Jacket & Dhoti Set',
      description: 'Structured silk peplum jacket with architectural zardozi lapels, styled over fluid draped satin dhoti pants.',
      basePrice: 15999,
    },
    {
      name: 'Asymmetrical Pleated Silk Tunic Set',
      description: 'Modern luxury high-low tunic featuring architectural pleats, paired with metallic cigarette pants and brooch detail.',
      basePrice: 13499,
    },
    {
      name: 'Pre-Draped Cocktail Gown with Pallu Detail',
      description: 'Couture evening gown merging Indian saree draping with western couture silhouettes in flowing crepe-georgette.',
      basePrice: 21999,
    },
  ],
  blouses: [
    {
      name: 'Aari Work Sweetheart Silk Blouse',
      description: 'Padded raw silk designer blouse featuring intricate aari needlework on the sleeves, deep sweetheart neckline, and latkan ties.',
      basePrice: 5499,
    },
    {
      name: 'Zardozi Embellished Deep-V Velvet Blouse',
      description: 'Couture black silk velvet blouse hand-embroidered with antique golden zardozi, plunging V-neck, and cap sleeves.',
      basePrice: 6999,
    },
    {
      name: 'Mirror Embroidered Sleeveless Brocade Blouse',
      description: 'Festive brocade crop blouse enriched with real mirror work, jewel neck, and back cutout with handcrafted fabric tassels.',
      basePrice: 4799,
    },
    {
      name: 'Pearl & Cutdana Handcrafted Padded Blouse',
      description: 'Ultra-luxurious evening blouse encrusted with freshwater pearl accents, cutdana jaal, and sheer illusion back.',
      basePrice: 7499,
    },
  ],
};

// Fallback products generator for any subcategories
function getProductsForSubcategory(slug: string, name: string): ProductDef[] {
  if (PRODUCTS_PER_SUBCATEGORY[slug]) {
    return PRODUCTS_PER_SUBCATEGORY[slug];
  }
  return [
    {
      name: `Heritage Embroidered ${name}`,
      description: `Handcrafted luxury ${name.toLowerCase()} featuring traditional artisan embroidery and premium pure fabric.`,
      basePrice: 9999,
    },
    {
      name: `Royal Festive Silk ${name}`,
      description: `Opulent ${name.toLowerCase()} woven with pure zari threads, rich borders, and festive grandeur.`,
      basePrice: 12499,
    },
    {
      name: `Contemporary Designer ${name}`,
      description: `Modern couture silhouette ${name.toLowerCase()} tailored for festive celebrations and evening glamour.`,
      basePrice: 14999,
    },
    {
      name: `Artisan Handwoven ${name}`,
      description: `Timeless heirloom ${name.toLowerCase()} crafted by master artisans using time-honored techniques.`,
      basePrice: 17999,
    },
  ];
}

function getImageSetForSubcategory(slug: string, productIndex: number): string[] {
  let key = 'sarees';
  if (slug.includes('lehenga')) key = 'lehengas';
  else if (slug.includes('suit') || slug.includes('anarkali') || slug.includes('kurta')) key = 'suits';
  else if (slug.includes('western') || slug.includes('gown')) key = 'indowestern';
  else if (slug.includes('blouse')) key = 'blouses';

  const sets = IMAGE_SETS[key] || IMAGE_SETS.sarees;
  return sets[productIndex % sets.length];
}

// Color palettes for ethnic couture
const COLOR_TRIOS = [
  ['Maroon', 'Emerald Green', 'Royal Blue'],
  ['Gold', 'Mustard Yellow', 'Pink'],
  ['Teal', 'Magenta', 'Navy Blue'],
  ['Red', 'Beige', 'Black'],
];

// 3 sizes for variants
const SIZES = ['S', 'M', 'L'];

async function main() {
  console.log('🚀 Starting Women Subcategories Product Seeding...\n');

  // 1. Ensure Attributes (Size, Color)
  const sizeAttr = await prisma.attribute.upsert({
    where: { name: 'Size' },
    update: {},
    create: { name: 'Size' },
  });

  const colorAttr = await prisma.attribute.upsert({
    where: { name: 'Color' },
    update: {},
    create: { name: 'Color' },
  });

  // Ensure size values exist with proper order numbers lowest to highest
  const sizeMap: Record<string, string> = {};
  const sizeOrderList: [string, number][] = [
    ['XS', 1],
    ['S', 2],
    ['M', 3],
    ['L', 4],
    ['XL', 5],
    ['XXL', 6],
    ['3XL', 7],
    ['Free Size', 8],
    ['Unstitched', 9],
  ];
  for (const [s, order] of sizeOrderList) {
    const val = await prisma.attributeValue.upsert({
      where: { attributeId_value: { attributeId: sizeAttr.id, value: s } },
      update: { sortOrder: order, orderList: order },
      create: { attributeId: sizeAttr.id, value: s, sortOrder: order, orderList: order },
    });
    sizeMap[s] = val.id;
  }

  // Ensure color values exist with proper color codes
  const colorHexEntries: [string, string][] = [
    ['Black', '#1A1A1A'],
    ['White', '#FFFFFF'],
    ['Navy Blue', '#1B2A4A'],
    ['Red', '#C0392B'],
    ['Olive Green', '#6B7C4D'],
    ['Maroon', '#7B1C2E'],
    ['Emerald Green', '#1A6B4A'],
    ['Royal Blue', '#1A3A7A'],
    ['Mustard Yellow', '#D4A017'],
    ['Pink', '#E8748A'],
    ['Gold', '#C9973A'],
    ['Teal', '#1A7B7B'],
    ['Magenta', '#B5226E'],
    ['Beige', '#E8DABB'],
  ];
  const colorMap: Record<string, string> = {};
  const colorHexMap: Record<string, string> = {};
  for (const [c, hex] of colorHexEntries) {
    const val = await prisma.attributeValue.upsert({
      where: { attributeId_value: { attributeId: colorAttr.id, value: c } },
      update: { colorCode: hex },
      create: { attributeId: colorAttr.id, value: c, colorCode: hex },
    });
    colorMap[c] = val.id;
    colorHexMap[c] = hex;
  }

  console.log('✅ Size and Color attribute values verified with color codes & sort orders.');

  // 2. Find Women Category and all its Subcategories
  const womenCategory = await prisma.category.findUnique({
    where: { slug: 'womens-wear' },
    include: { children: true },
  });

  if (!womenCategory) {
    throw new Error('Women parent category (womens-wear) not found in database!');
  }

  const subcategories = womenCategory.children;
  console.log(`Found ${subcategories.length} subcategories under Women (${womenCategory.name}):`);
  subcategories.forEach(sub => console.log(` - ${sub.name} (slug: ${sub.slug})`));

  let totalGroupsCreated = 0;
  let totalProductsCreated = 0;
  let totalVariantsCreated = 0;
  let totalImagesCreated = 0;

  // 3. For each subcategory, insert 4 products
  for (const subcategory of subcategories) {
    console.log(`\n📦 Processing Subcategory: [${subcategory.name}] (${subcategory.slug})...`);

    const productsDef = getProductsForSubcategory(subcategory.slug, subcategory.name);

    for (let pIdx = 0; pIdx < productsDef.length; pIdx++) {
      const def = productsDef[pIdx];
      const colorTrio = COLOR_TRIOS[pIdx % COLOR_TRIOS.length];
      const imageSet = getImageSetForSubcategory(subcategory.slug, pIdx);

      // Create or update ProductGroup
      const groupSlug = slugify(`${subcategory.slug}-${def.name}`, { lower: true, strict: true });
      const group = await prisma.productGroup.upsert({
        where: { slug: groupSlug },
        update: {
          name: def.name,
          description: def.description,
          categoryId: subcategory.id,
        },
        create: {
          name: def.name,
          slug: groupSlug,
          description: def.description,
          categoryId: subcategory.id,
        },
      });
      totalGroupsCreated++;

      // Create 3 Colours (Product records) for this ProductGroup
      for (let cIdx = 0; cIdx < colorTrio.length; cIdx++) {
        const colorName = colorTrio[cIdx];
        const colorId = colorMap[colorName];
        const isPrimary = cIdx === 0;

        const productSlug = `${groupSlug}-${slugify(colorName, { lower: true, strict: true })}`;
        const productName = `${def.name} - ${colorName}`;

        // Base price calculation: slight variance by color
        const colorBasePrice = def.basePrice + (cIdx * 500);
        const colorComparePrice = colorBasePrice + 2500;

        const product = await prisma.product.upsert({
          where: { slug: productSlug },
          update: {
            name: productName,
            groupId: group.id,
            colorId,
            colorCode: colorHexMap[colorName],
            categoryId: subcategory.id,
            basePrice: colorBasePrice,
            comparePrice: colorComparePrice,
            shortDescription: `${def.name} in royal ${colorName}. Handcrafted luxury detailing.`,
            description: `${def.description} Presented in exquisite ${colorName}. Dry clean only. Shanandra luxury bespoke ethnic couture.`,
            isPrimary,
            isActive: true,
            isFeatured: true,
            taxRate: 5,
            metaTitle: `${productName} | Shanandra Luxury Couture`,
            metaDescription: `${def.name} in ${colorName}. Handcrafted Indian ethnic wear. Free insured shipping.`,
            keywords: [subcategory.name.toLowerCase(), colorName.toLowerCase(), 'ethnic wear', 'luxury', 'shanandra'],
          },
          create: {
            name: productName,
            slug: productSlug,
            groupId: group.id,
            colorId,
            colorCode: colorHexMap[colorName],
            categoryId: subcategory.id,
            basePrice: colorBasePrice,
            comparePrice: colorComparePrice,
            shortDescription: `${def.name} in royal ${colorName}. Handcrafted luxury detailing.`,
            description: `${def.description} Presented in exquisite ${colorName}. Dry clean only. Shanandra luxury bespoke ethnic couture.`,
            isPrimary,
            isActive: true,
            isFeatured: true,
            taxRate: 5,
            metaTitle: `${productName} | Shanandra Luxury Couture`,
            metaDescription: `${def.name} in ${colorName}. Handcrafted Indian ethnic wear. Free insured shipping.`,
            keywords: [subcategory.name.toLowerCase(), colorName.toLowerCase(), 'ethnic wear', 'luxury', 'shanandra'],
          },
        });
        totalProductsCreated++;

        // 3 Product Images per Colour Product
        // Clean existing images for this product before inserting
        await prisma.productImage.deleteMany({ where: { productId: product.id } });

        for (let imgIdx = 0; imgIdx < 3; imgIdx++) {
          const imgUrl = imageSet[imgIdx % imageSet.length];
          const viewLabel = imgIdx === 0 ? 'Front View' : imgIdx === 1 ? 'Detail View' : 'Styling View';

          await prisma.productImage.create({
            data: {
              productId: product.id,
              url: imgUrl,
              altText: `${productName} - ${viewLabel}`,
              sortOrder: imgIdx,
              isPrimary: imgIdx === 0,
            },
          });
          totalImagesCreated++;
        }

        // 3 Sizes per Product with DIFFERENT PRICES for each size!
        // S: basePrice
        // M: basePrice + 500
        // L: basePrice + 1200
        const sizePriceDeltas: Record<string, { delta: number; compareDelta: number }> = {
          S: { delta: 0, compareDelta: 0 },
          M: { delta: 500, compareDelta: 600 },
          L: { delta: 1200, compareDelta: 1500 },
        };

        for (let sIdx = 0; sIdx < SIZES.length; sIdx++) {
          const sizeName = SIZES[sIdx];
          const sizeId = sizeMap[sizeName];
          const { delta, compareDelta } = sizePriceDeltas[sizeName];

          const variantPrice = colorBasePrice + delta;
          const variantComparePrice = colorComparePrice + compareDelta;
          const sku = `SHA-${subcategory.slug.toUpperCase()}-${pIdx + 1}-${colorName.substring(0, 3).toUpperCase()}-${sizeName}`.replace(/[^A-Z0-9-]/g, '');

          const existingBySku = await prisma.productVariant.findUnique({ where: { sku } });
          let variant;
          if (existingBySku) {
            variant = await prisma.productVariant.update({
              where: { id: existingBySku.id },
              data: {
                productId: product.id,
                sizeId,
                price: variantPrice,
                comparePrice: variantComparePrice,
                sortOrder: sIdx + 2,
                orderList: sIdx + 2,
                isActive: true,
              },
            });
          } else {
            variant = await prisma.productVariant.upsert({
              where: { productId_sizeId: { productId: product.id, sizeId } },
              update: {
                sku,
                price: variantPrice,
                comparePrice: variantComparePrice,
                sortOrder: sIdx + 2,
                orderList: sIdx + 2,
                isActive: true,
              },
              create: {
                productId: product.id,
                sizeId,
                sku,
                price: variantPrice,
                comparePrice: variantComparePrice,
                sortOrder: sIdx + 2,
                orderList: sIdx + 2,
                isActive: true,
              },
            });
          }
          totalVariantsCreated++;

          // Ensure inventory exists
          await prisma.inventory.upsert({
            where: { variantId: variant.id },
            update: {
              quantity: 20 + ((pIdx + cIdx + sIdx) * 5),
              reservedQuantity: 0,
              lowStockAt: 5,
            },
            create: {
              variantId: variant.id,
              quantity: 20 + ((pIdx + cIdx + sIdx) * 5),
              reservedQuantity: 0,
              lowStockAt: 5,
            },
          });

          // Link variant attribute
          await prisma.variantAttribute.upsert({
            where: {
              variantId_attributeValueId: {
                variantId: variant.id,
                attributeValueId: sizeId,
              },
            },
            update: {},
            create: {
              variantId: variant.id,
              attributeValueId: sizeId,
            },
          });
        }
      }

      console.log(`   ✓ Product [${def.name}]: 3 colours, 9 images, 9 size-variants (with distinct prices) seeded.`);
    }
  }

  console.log('\n======================================================');
  console.log('🎉 SEED COMPLETED SUCCESSFULLY!');
  console.log(`- Subcategories Processed: ${subcategories.length}`);
  console.log(`- Product Groups Created:  ${totalGroupsCreated}`);
  console.log(`- Colour Products Created: ${totalProductsCreated} (3 colours per product)`);
  console.log(`- Product Images Created:  ${totalImagesCreated} (3 images per colour product)`);
  console.log(`- Size Variants Created:   ${totalVariantsCreated} (3 sizes with different prices)`);
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
