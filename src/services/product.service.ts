import { prisma } from '../config/prisma';
import { productRepository } from '../repositories/product.repository';
import { generateSlug } from '../utils/slug';
import { NotFoundError, ConflictError, BusinessError } from '../lib/errors';
import { cache } from '../lib/cache';
import { auditService } from './audit.service';
import crypto from 'crypto';
import type {
  CreateProductInput,
  UpdateProductInput,
  CloneColourInput,
  ReorderImagesInput,
  ProductFilterInput,
} from '../validators/product.validator';

async function makeUniqueSlug(name: string): Promise<string> {
  const base = generateSlug(name);
  const existing = await prisma.product.findUnique({ where: { slug: base } });
  if (!existing) return base;
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

async function makeUniqueGroupSlug(name: string): Promise<string> {
  const base = generateSlug(name);
  const existing = await prisma.productGroup.findUnique({ where: { slug: base } });
  if (!existing) return base;
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

export class ProductService {
  async list(filters: ProductFilterInput) {
    const cacheKey = `products:list:${JSON.stringify(filters)}`;
    const cached = cache.get<{ items: unknown[]; total: number }>(cacheKey);
    if (cached !== null) return cached;

    const result = await productRepository.findMany(filters);
    cache.set(cacheKey, result, 30);
    return result;
  }

  async getBySlug(slug: string) {
    const cacheKey = `products:slug:${slug}`;
    const cached = cache.get<unknown>(cacheKey);
    if (cached !== null) return cached;

    const product = await productRepository.findBySlug(slug);
    if (!product) throw new NotFoundError('Product');

    cache.set(cacheKey, product, 60);
    return product;
  }

  async getById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  async getAttributes() {
    return productRepository.findAttributes();
  }

  async create(input: CreateProductInput, adminId: string) {
    // 1. Validate Category
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundError('Category');

    // 2. Validate Color attribute value
    const color = await prisma.attributeValue.findUnique({ where: { id: input.colorId } });
    if (!color) throw new NotFoundError('Colour attribute value');

    // 3. Validate all Size attribute values
    const sizeIds = input.sizes.map((s) => s.sizeId);
    const existingSizes = await prisma.attributeValue.findMany({
      where: { id: { in: sizeIds } },
    });
    if (existingSizes.length !== sizeIds.length) {
      throw new BusinessError('One or more selected sizes are invalid');
    }
    const sizeMap = new Map(existingSizes.map((s) => [s.id, s.value]));

    const productSlug = await makeUniqueSlug(input.name);
    const groupSlug = !input.groupId
      ? await makeUniqueGroupSlug(input.groupName || input.name)
      : null;

    const product = await prisma.$transaction(
      async (tx) => {
        let groupId = input.groupId;

        if (groupId) {
          // Verify group exists
          const group = await tx.productGroup.findUnique({ where: { id: groupId } });
          if (!group) throw new NotFoundError('Product Group');

          // Verify color is unique in this group
          const existingColorProduct = await tx.product.findFirst({
            where: { groupId, colorId: input.colorId, deletedAt: null },
          });
          if (existingColorProduct) {
            throw new ConflictError(
              `A product with colour "${color.value}" already exists in this Product Group`
            );
          }
        } else {
          // Create new Product Group
          const groupName = input.groupName || input.name;
          const newGroup = await tx.productGroup.create({
            data: {
              name: groupName,
              slug: groupSlug!,
              description: input.shortDescription || input.description || null,
              categoryId: input.categoryId,
            },
          });
          groupId = newGroup.id;
        }

        // Check existing active products in group for primary product logic
        const activeGroupCount = await tx.product.count({
          where: { groupId, deletedAt: null },
        });

        // First product is always primary, or respect admin's choice
        const shouldBePrimary = activeGroupCount === 0 || input.isPrimary === true;

        if (shouldBePrimary) {
          await tx.product.updateMany({
            where: { groupId, isPrimary: true },
            data: { isPrimary: false },
          });
        }

        // Create Product record with nested variants & inventories in a single atomic batch
        const created = await tx.product.create({
          data: {
            groupId,
            colorId: input.colorId,
            categoryId: input.categoryId,
            name: input.name,
            slug: productSlug,
            shortDescription: input.shortDescription,
            description: input.description,
            basePrice: input.basePrice,
            comparePrice: input.comparePrice,
            taxRate: input.taxRate,
            isPrimary: shouldBePrimary,
            isActive: input.isActive,
            isFeatured: input.isFeatured,
            metaTitle: input.metaTitle,
            metaDescription: input.metaDescription,
            keywords: input.keywords,
            variants: {
              create: input.sizes.map((s) => {
                const sizeVal = sizeMap.get(s.sizeId) || 'SIZE';
                const rawSku =
                  s.sku ||
                  `${productSlug.substring(0, 12).toUpperCase()}-${sizeVal.toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

                return {
                  sizeId: s.sizeId,
                  sku: rawSku,
                  price: s.price,
                  comparePrice: s.comparePrice ?? input.comparePrice,
                  isActive: true,
                  inventory: {
                    create: {
                      quantity: s.stock,
                    },
                  },
                };
              }),
            },
          },
        });

        return created;
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    cache.delPattern('products:');
    await auditService.log(
      'product',
      product.id,
      'CREATE',
      null,
      { name: product.name, slug: product.slug, groupId: product.groupId },
      adminId
    );

    return productRepository.findById(product.id);
  }

  async update(id: string, input: UpdateProductInput, adminId: string) {
    const existing = await productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product');

    // If colour is changed, ensure uniqueness in group
    if (input.colorId && input.colorId !== existing.colorId) {
      const duplicate = await prisma.product.findFirst({
        where: {
          groupId: existing.groupId,
          colorId: input.colorId,
          id: { not: id },
          deletedAt: null,
        },
      });
      if (duplicate) {
        throw new ConflictError('A product with this colour already exists in the Product Group');
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Primary product management
      if (input.isPrimary === true && !existing.isPrimary) {
        await tx.product.updateMany({
          where: { groupId: existing.groupId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      // Update base fields
      const p = await tx.product.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.shortDescription !== undefined && { shortDescription: input.shortDescription }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.colorId !== undefined && { colorId: input.colorId }),
          ...(input.basePrice !== undefined && { basePrice: input.basePrice }),
          ...(input.comparePrice !== undefined && { comparePrice: input.comparePrice }),
          ...(input.taxRate !== undefined && { taxRate: input.taxRate }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
          ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
          ...(input.metaTitle !== undefined && { metaTitle: input.metaTitle }),
          ...(input.metaDescription !== undefined && { metaDescription: input.metaDescription }),
          ...(input.keywords !== undefined && { keywords: input.keywords }),
        },
      });

      // Update sizes if provided
      if (input.sizes) {
        const inputSizeIds = new Set(input.sizes.map((s) => s.sizeId));

        // Deactivate or remove existing variants not in input
        const currentVariants = await tx.productVariant.findMany({
          where: { productId: id },
          include: { inventory: true },
        });

        for (const cv of currentVariants) {
          if (!inputSizeIds.has(cv.sizeId)) {
            await tx.productVariant.update({
              where: { id: cv.id },
              data: { isActive: false, deletedAt: new Date() },
            });
          }
        }

        // Upsert requested sizes
        for (const s of input.sizes) {
          const match = currentVariants.find((cv) => cv.sizeId === s.sizeId);
          if (match) {
            await tx.productVariant.update({
              where: { id: match.id },
              data: {
                price: s.price,
                comparePrice: s.comparePrice,
                isActive: true,
                deletedAt: null,
              },
            });
            if (match.inventory) {
              await tx.inventory.update({
                where: { id: match.inventory.id },
                data: { quantity: s.stock },
              });
            } else {
              await tx.inventory.create({
                data: { variantId: match.id, quantity: s.stock },
              });
            }
          } else {
            const rawSku =
              s.sku ||
              `${p.slug.substring(0, 12).toUpperCase()}-SIZE-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
            const newV = await tx.productVariant.create({
              data: {
                productId: id,
                sizeId: s.sizeId,
                sku: rawSku,
                price: s.price,
                comparePrice: s.comparePrice,
                isActive: true,
              },
            });
            await tx.inventory.create({
              data: { variantId: newV.id, quantity: s.stock },
            });
          }
        }
      }

      return p;
    }, {
      maxWait: 20000,
      timeout: 60000,
    });

    cache.delPattern('products:');
    await auditService.log('product', id, 'UPDATE', existing, updated, adminId);

    return productRepository.findById(id);
  }

  async highlightPrimary(id: string, adminId: string) {
    const product = await productRepository.findById(id);
    if (!product) throw new NotFoundError('Product');

    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { groupId: product.groupId },
        data: { isPrimary: false },
      });
      await tx.product.update({
        where: { id },
        data: { isPrimary: true },
      });
    }, {
      maxWait: 20000,
      timeout: 60000,
    });

    cache.delPattern('products:');
    await auditService.log(
      'product',
      id,
      'HIGHLIGHT_PRIMARY',
      { isPrimary: false },
      { isPrimary: true },
      adminId
    );

    return productRepository.findById(id);
  }

  async cloneColour(sourceProductId: string, input: CloneColourInput, adminId: string) {
    const source = await productRepository.findById(sourceProductId);
    if (!source) throw new NotFoundError('Source Product');

    // Validate new colour
    const color = await prisma.attributeValue.findUnique({ where: { id: input.colorId } });
    if (!color) throw new NotFoundError('Colour attribute value');

    // Check duplicate color in group
    const existingColorProduct = await prisma.product.findFirst({
      where: { groupId: source.groupId, colorId: input.colorId, deletedAt: null },
    });
    if (existingColorProduct) {
      throw new ConflictError(
        `A product with colour "${color.value}" already exists in this Product Group`
      );
    }

    const groupName = source.group.name;
    const newName = input.name || `${groupName} — ${color.value}`;
    const newSlug = await makeUniqueSlug(newName);

    const cloned = await prisma.$transaction(
      async (tx) => {
        // Sizes: use input.sizes if provided, otherwise duplicate from source
        const sizesToCreate =
          input.sizes && input.sizes.length > 0
            ? input.sizes
            : source.variants.map((v) => ({
                sizeId: v.sizeId,
                price: v.price ? Number(v.price) : Number(source.basePrice),
                comparePrice: v.comparePrice ? Number(v.comparePrice) : null,
                stock: v.inventory?.quantity ?? 0,
              }));

        const created = await tx.product.create({
          data: {
            groupId: source.groupId,
            colorId: input.colorId,
            categoryId: source.categoryId,
            name: newName,
            slug: newSlug,
            shortDescription: source.shortDescription,
            description: source.description,
            basePrice: input.basePrice ?? source.basePrice,
            comparePrice: input.comparePrice ?? source.comparePrice,
            taxRate: source.taxRate,
            isPrimary: false, // Cloned colour is never primary by default
            isActive: source.isActive,
            isFeatured: source.isFeatured,
            metaTitle: source.metaTitle,
            metaDescription: source.metaDescription,
            keywords: source.keywords,
            variants: {
              create: sizesToCreate.map((s) => ({
                sizeId: s.sizeId,
                sku: `${newSlug.substring(0, 12).toUpperCase()}-SIZE-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
                price: s.price,
                comparePrice: s.comparePrice,
                isActive: true,
                inventory: {
                  create: {
                    quantity: s.stock,
                  },
                },
              })),
            },
          },
        });

        // DO NOT DUPLICATE IMAGES (per requirements)
        return created;
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    cache.delPattern('products:');
    await auditService.log(
      'product',
      cloned.id,
      'CLONE_COLOUR',
      null,
      { sourceProductId, newColorId: input.colorId, name: cloned.name },
      adminId
    );

    return productRepository.findById(cloned.id);
  }

  async delete(id: string, adminId: string): Promise<void> {
    const existing = await productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product');

    await prisma.$transaction(async (tx) => {
      // Soft-delete the product
      await tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, isPrimary: false },
      });

      // Soft-delete its variants
      await tx.productVariant.updateMany({
        where: { productId: id },
        data: { deletedAt: new Date(), isActive: false },
      });

      // If the deleted product was the primary product:
      if (existing.isPrimary) {
        // Find another active, non-deleted product in the same group
        const nextPrimary = await tx.product.findFirst({
          where: {
            groupId: existing.groupId,
            deletedAt: null,
            id: { not: id },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (nextPrimary) {
          // Promote next product to primary
          await tx.product.update({
            where: { id: nextPrimary.id },
            data: { isPrimary: true },
          });
        } else {
          // No products remain in the group -> delete the Product Group
          await tx.productGroup.delete({
            where: { id: existing.groupId },
          });
        }
      } else {
        // Check if any active products remain in the group
        const remainingCount = await tx.product.count({
          where: {
            groupId: existing.groupId,
            deletedAt: null,
          },
        });

        if (remainingCount === 0) {
          await tx.productGroup.delete({
            where: { id: existing.groupId },
          });
        }
      }
    });

    cache.delPattern('products:');
    await auditService.log('product', id, 'DELETE', existing, null, adminId);
  }

  async reorderImages(productId: string, input: ReorderImagesInput) {
    const product = await productRepository.findById(productId);
    if (!product) throw new NotFoundError('Product');

    await prisma.$transaction(async (tx) => {
      for (const item of input.images) {
        await tx.productImage.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            ...(item.isPrimary !== undefined && { isPrimary: item.isPrimary }),
          },
        });
      }
    });

    cache.delPattern('products:');
    return productRepository.findById(productId);
  }
}

export const productService = new ProductService();
