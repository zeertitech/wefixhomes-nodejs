import { prisma } from '../config/prisma';
import { productRepository } from '../repositories/product.repository';
import { generateSlug } from '../utils/slug';
import { NotFoundError, ConflictError } from '../lib/errors';
import { cache } from '../lib/cache';
import { auditService } from './audit.service';
import type { CreateProductInput, UpdateProductInput, ProductFilterInput } from '../validators/product.validator';

export class ProductService {
  async list(filters: ProductFilterInput) {
    const cacheKey = `products:list:${JSON.stringify(filters)}`;
    const cached = cache.get<{ items: unknown[]; total: number }>(cacheKey);
    if (cached !== null) return cached;

    const result = await productRepository.findMany(filters);
    cache.set(cacheKey, result, 60); // 60 second TTL
    return result;
  }

  async getBySlug(slug: string) {
    const cacheKey = `products:slug:${slug}`;
    const cached = cache.get<unknown>(cacheKey);
    if (cached !== null) return cached;

    const product = await productRepository.findBySlug(slug);
    if (!product) throw new NotFoundError('Product');

    cache.set(cacheKey, product, 120);
    return product;
  }

  async getById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  async create(input: CreateProductInput, adminId: string) {
    const slug = generateSlug(input.name);

    const product = await prisma.$transaction(async (tx) => {
      // Create base product
      const created = await tx.product.create({
        data: {
          name: input.name,
          slug,
          categoryId: input.categoryId,
          description: input.description,
          basePrice: input.basePrice,
          taxRate: input.taxRate,
          isActive: input.isActive,
          isFeatured: input.isFeatured,
          metaTitle: input.metaTitle,
          metaDescription: input.metaDescription,
          keywords: input.keywords,
        },
      });

      // Create each variant
      for (const variant of input.variants) {
        const existing = await tx.productVariant.findUnique({
          where: { sku: variant.sku },
        });
        if (existing) throw new ConflictError(`SKU "${variant.sku}" already exists`);

        const createdVariant = await tx.productVariant.create({
          data: {
            productId: created.id,
            sku: variant.sku,
            price: variant.price,
            comparePrice: variant.comparePrice,
          },
        });

        // Create inventory record
        await tx.inventory.create({
          data: {
            variantId: createdVariant.id,
            quantity: variant.stock,
          },
        });

        // Link attributes
        for (const attr of variant.attributes) {
          await tx.variantAttribute.create({
            data: {
              variantId: createdVariant.id,
              attributeValueId: attr.valueId,
            },
          });
        }
      }

      return created;
    });

    cache.delPattern('products:');
    await auditService.log('product', product.id, 'CREATE', null, { name: product.name, slug }, adminId);

    return product;
  }

  async update(id: string, input: UpdateProductInput, adminId: string) {
    const existing = await productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product');

    const updated = await productRepository.update(id, {
      ...input,
      ...(input.basePrice !== undefined && { basePrice: input.basePrice }),
      ...(input.taxRate !== undefined && { taxRate: input.taxRate }),
    });

    cache.delPattern('products:');
    await auditService.log('product', id, 'UPDATE', existing, updated, adminId);

    return updated;
  }

  async delete(id: string, adminId: string): Promise<void> {
    const existing = await productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product');

    await productRepository.softDelete(id);

    cache.delPattern('products:');
    await auditService.log('product', id, 'DELETE', existing, null, adminId);
  }

  async addVariant(
    productId: string,
    variant: {
      sku: string;
      price: number;
      comparePrice?: number;
      stock: number;
      attributes: { attributeId: string; valueId: string }[];
    },
    adminId: string
  ) {
    const product = await productRepository.findById(productId);
    if (!product) throw new NotFoundError('Product');

    const existing = await prisma.productVariant.findUnique({ where: { sku: variant.sku } });
    if (existing) throw new ConflictError(`SKU "${variant.sku}" already exists`);

    const created = await prisma.$transaction(async (tx) => {
      const v = await tx.productVariant.create({
        data: {
          productId,
          sku: variant.sku,
          price: variant.price,
          comparePrice: variant.comparePrice,
        },
      });

      await tx.inventory.create({
        data: { variantId: v.id, quantity: variant.stock },
      });

      for (const attr of variant.attributes) {
        await tx.variantAttribute.create({
          data: { variantId: v.id, attributeValueId: attr.valueId },
        });
      }

      return v;
    });

    cache.delPattern('products:');
    await auditService.log('variant', created.id, 'CREATE', null, created, adminId);
    return created;
  }
}

export const productService = new ProductService();
