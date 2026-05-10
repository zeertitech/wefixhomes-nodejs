import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.development') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const PEPPER = process.env['PEPPER_SECRET'] ?? 'dev_pepper_secret_minimum_32_characters_here!!!';

async function main(): Promise<void> {
  console.log('🌱 Seeding database...\n');

  // ── Admin User ────────────────────────────────────────────
  const passwordHash = await argon2.hash('Admin@123' + PEPPER, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fashionstore.com' },
    update: {},
    create: {
      email: 'admin@fashionstore.com',
      passwordHash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
    },
  });
  console.log('✅ Admin user:', admin.email);

  // ── Attributes ────────────────────────────────────────────
  const sizeAttr = await prisma.attribute.upsert({
    where: { name: 'Size' },
    update: {},
    create: {
      name: 'Size',
      values: {
        create: [
          { value: 'XS' },
          { value: 'S' },
          { value: 'M' },
          { value: 'L' },
          { value: 'XL' },
          { value: 'XXL' },
        ],
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
          { value: 'Navy Blue' },
          { value: 'Red' },
          { value: 'Olive Green' },
        ],
      },
    },
    include: { values: true },
  });

  console.log('✅ Attributes seeded (Size, Color)');

  // ── Categories ────────────────────────────────────────────
  const mensCat = await prisma.category.upsert({
    where: { slug: 'mens' },
    update: {},
    create: { name: "Men's", slug: 'mens', description: "Men's clothing", sortOrder: 1 },
  });

  const tshirtCat = await prisma.category.upsert({
    where: { slug: 'mens-tshirts' },
    update: {},
    create: {
      name: "Men's T-Shirts",
      slug: 'mens-tshirts',
      description: 'Classic and modern t-shirts',
      parentId: mensCat.id,
      sortOrder: 1,
    },
  });

  await prisma.category.upsert({
    where: { slug: 'mens-shirts' },
    update: {},
    create: {
      name: "Men's Shirts",
      slug: 'mens-shirts',
      description: 'Formal and casual shirts',
      parentId: mensCat.id,
      sortOrder: 2,
    },
  });

  console.log('✅ Categories seeded');

  // ── Sample Product ────────────────────────────────────────
  const product = await prisma.product.upsert({
    where: { slug: 'classic-crew-neck-tshirt-001' },
    update: {},
    create: {
      name: 'Classic Crew Neck T-Shirt',
      slug: 'classic-crew-neck-tshirt-001',
      categoryId: tshirtCat.id,
      description:
        'Premium 100% cotton crew neck t-shirt with a comfortable relaxed fit. Perfect for everyday wear.',
      basePrice: 799,
      taxRate: 5,
      isActive: true,
      isFeatured: true,
      metaTitle: 'Classic Crew Neck T-Shirt | Fashion Store',
      metaDescription:
        'Premium cotton crew neck t-shirt available in multiple sizes and colors. Free shipping on orders above ₹999.',
      keywords: ['tshirt', 'men', 'cotton', 'crew neck', 'casual'],
    },
  });

  // ── Variants ──────────────────────────────────────────────
  const sizeM = sizeAttr.values.find((v) => v.value === 'M');
  const sizeL = sizeAttr.values.find((v) => v.value === 'L');
  const colorBlack = colorAttr.values.find((v) => v.value === 'Black');
  const colorWhite = colorAttr.values.find((v) => v.value === 'White');
  const colorNavy = colorAttr.values.find((v) => v.value === 'Navy Blue');

  const variants = [
    { sku: 'CCN-M-BLK', price: 799, stock: 50, sizeId: sizeM?.id, colorId: colorBlack?.id },
    { sku: 'CCN-M-WHT', price: 799, stock: 40, sizeId: sizeM?.id, colorId: colorWhite?.id },
    { sku: 'CCN-M-NVY', price: 799, stock: 35, sizeId: sizeM?.id, colorId: colorNavy?.id },
    { sku: 'CCN-L-BLK', price: 849, stock: 45, sizeId: sizeL?.id, colorId: colorBlack?.id },
    { sku: 'CCN-L-WHT', price: 849, stock: 30, sizeId: sizeL?.id, colorId: colorWhite?.id },
  ];

  for (const v of variants) {
    if (!v.sizeId || !v.colorId) continue;

    const variant = await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: {},
      create: {
        productId: product.id,
        sku: v.sku,
        price: v.price,
        comparePrice: v.price + 200,
      },
    });

    await prisma.inventory.upsert({
      where: { variantId: variant.id },
      update: {},
      create: { variantId: variant.id, quantity: v.stock },
    });

    for (const avId of [v.sizeId, v.colorId]) {
      await prisma.variantAttribute
        .upsert({
          where: {
            variantId_attributeValueId: { variantId: variant.id, attributeValueId: avId },
          },
          update: {},
          create: { variantId: variant.id, attributeValueId: avId },
        })
        .catch(() => {});
    }
  }

  console.log('✅ Sample product with 5 variants seeded');

  // ── Sample Coupon ─────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 500,
      maxDiscount: 200,
      usageLimit: 1000,
      isActive: true,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'FLAT100' },
    update: {},
    create: {
      code: 'FLAT100',
      discountType: 'FIXED',
      discountValue: 100,
      minOrderAmount: 999,
      isActive: true,
    },
  });

  console.log('✅ Sample coupons seeded (WELCOME10, FLAT100)');

  // ── Sample Customer ───────────────────────────────────────
  const customer = await prisma.customer.upsert({
    where: { email: 'priya@example.com' },
    update: {},
    create: {
      email: 'priya@example.com',
      phone: '9876543210',
      firstName: 'Priya',
      lastName: 'Sharma',
    },
  });

  await prisma.address.upsert({
    where: { id: 'seed-address-001' },
    update: {},
    create: {
      id: 'seed-address-001',
      customerId: customer.id,
      name: 'Priya Sharma',
      phone: '9876543210',
      line1: '123 MG Road',
      line2: 'Near Brigade Junction',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
      isDefault: true,
    },
  });

  console.log('✅ Sample customer seeded');

  console.log('\n🎉 Seeding complete!\n');
  console.log('──────────────────────────────────────────');
  console.log('Admin Login:');
  console.log('  Email    : admin@fashionstore.com');
  console.log('  Password : Admin@123');
  console.log('──────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
