import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { ProductFilterInput } from '../validators/product.validator';

export class ProductRepository {
  async findMany(filters: ProductFilterInput) {
    const skip = (filters.page - 1) * filters.limit;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(filters.categoryId !== undefined && { categoryId: filters.categoryId }),
      ...(filters.groupId !== undefined && { groupId: filters.groupId }),
      ...(filters.colorId !== undefined && { colorId: filters.colorId }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.isFeatured !== undefined && { isFeatured: filters.isFeatured }),
      ...(filters.isPrimary !== undefined && { isPrimary: filters.isPrimary }),
      ...(filters.search !== undefined && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { shortDescription: { contains: filters.search, mode: 'insensitive' } },
          { group: { name: { contains: filters.search, mode: 'insensitive' } } },
          { color: { value: { contains: filters.search, mode: 'insensitive' } } },
          { keywords: { has: filters.search.toLowerCase() } },
        ],
      }),
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            basePrice: {
              ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
              ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
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
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              parent: { select: { id: true, name: true } },
            },
          },
          color: { select: { id: true, value: true } },
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
              products: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  isPrimary: true,
                  isActive: true,
                  color: { select: { id: true, value: true } },
                },
              },
            },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
          },
          variants: {
            where: { isActive: true, deletedAt: null },
            include: {
              size: { select: { id: true, value: true } },
              inventory: {
                select: { quantity: true, reservedQuantity: true, lowStockAt: true },
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
        color: true,
        group: {
          include: {
            products: {
              where: { deletedAt: null },
              include: {
                color: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          where: { isActive: true, deletedAt: null },
          include: {
            size: true,
            inventory: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        color: true,
        group: {
          include: {
            products: {
              where: { deletedAt: null },
              include: {
                color: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          where: { isActive: true, deletedAt: null },
          include: {
            size: true,
            inventory: true,
          },
        },
      },
    });
  }

  async findAttributes() {
    const [colorAttr, sizeAttr] = await Promise.all([
      prisma.attribute.findUnique({
        where: { name: 'Color' },
        include: { values: { orderBy: { value: 'asc' } } },
      }),
      prisma.attribute.findUnique({
        where: { name: 'Size' },
        include: { values: { orderBy: { value: 'asc' } } },
      }),
    ]);

    return {
      colors: colorAttr?.values ?? [],
      sizes: sizeAttr?.values ?? [],
    };
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, isPrimary: false },
    });
  }
}

export const productRepository = new ProductRepository();
