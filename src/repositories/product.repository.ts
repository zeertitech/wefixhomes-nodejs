import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { ProductFilterInput } from '../validators/product.validator';

export class ProductRepository {
  async findMany(filters: ProductFilterInput) {
    const skip = (filters.page - 1) * filters.limit;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(filters.categoryId !== undefined && { categoryId: filters.categoryId }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.isFeatured !== undefined && { isFeatured: filters.isFeatured }),
      ...(filters.search !== undefined && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { keywords: { has: filters.search.toLowerCase() } },
        ],
      }),
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            variants: {
              some: {
                deletedAt: null,
                isActive: true,
                price: {
                  ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
                  ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
                },
              },
            },
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput = filters.sortBy
      ? { [filters.sortBy]: filters.order }
      : { createdAt: filters.order };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true, altText: true },
          },
          variants: {
            where: { isActive: true, deletedAt: null },
            include: {
              inventory: {
                select: { quantity: true, reservedQuantity: true },
              },
              attributes: {
                include: {
                  attributeValue: {
                    include: { attribute: { select: { id: true, name: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  async findBySlug(slug: string) {
    return prisma.product.findFirst({
      where: { slug, deletedAt: null },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          where: { isActive: true, deletedAt: null },
          include: {
            inventory: true,
            images: true,
            attributes: {
              include: {
                attributeValue: {
                  include: { attribute: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}

export const productRepository = new ProductRepository();
