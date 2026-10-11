import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { ProductFilterInput, PublicProductFilterInput } from '../validators/product.validator';

export class ProductRepository {
  async findMany(filters: ProductFilterInput) {
    const skip = (filters.page - 1) * filters.limit;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(filters.categoryId !== undefined && { categoryId: filters.categoryId }),
      ...(filters.categorySlug !== undefined && {
        category: {
          OR: [
            { slug: filters.categorySlug },
            { parent: { slug: filters.categorySlug } },
          ],
        },
      }),
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
              parent: { select: { id: true, name: true, slug: true } },
            },
          },
          color: { select: { id: true, value: true, colorCode: true } },
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
              products: {
                where: { deletedAt: null },
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  colorCode: true,
                  isPrimary: true,
                  isActive: true,
                  color: { select: { id: true, value: true, colorCode: true } },
                  images: {
                    take: 1,
                    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                    select: { url: true, altText: true },
                  },
                },
              },
            },
          },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          variants: {
            where: { isActive: true, deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
            include: {
              size: { select: { id: true, value: true, sortOrder: true, orderList: true } },
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

  async findPublicProducts(filters: PublicProductFilterInput) {
    const skip = (filters.page - 1) * filters.limit;

    // 1. Resolve Category hierarchy
    let categoryIds: string[] | undefined = undefined;
    const catQuery =
      filters.subCategorySlug ||
      filters.subCategory ||
      filters.categorySlug ||
      filters.category ||
      filters.categoryId;

    if (catQuery) {
      const matchedCat = await prisma.category.findFirst({
        where: {
          OR: [
            { slug: catQuery },
            { id: catQuery },
            ...(catQuery === 'women' ? [{ slug: 'womens-wear' }] : []),
            ...(catQuery === 'men' ? [{ slug: 'mens-wear' }] : []),
            ...(catQuery === 'kids' ? [{ slug: 'kids-festive' }] : []),
          ],
          isActive: true,
        },
        include: {
          children: {
            where: { isActive: true },
            select: {
              id: true,
              slug: true,
              children: {
                where: { isActive: true },
                select: { id: true, slug: true },
              },
            },
          },
        },
      });

      if (matchedCat) {
        const ids = new Set<string>();
        ids.add(matchedCat.id);
        matchedCat.children.forEach((c) => {
          ids.add(c.id);
          c.children?.forEach((gc) => ids.add(gc.id));
        });
        categoryIds = Array.from(ids);
      } else {
        categoryIds = [catQuery];
      }
    }

    // 2. Normalize sizes
    const sizeList: string[] = [];
    if (filters.sizes && Array.isArray(filters.sizes)) {
      sizeList.push(...filters.sizes);
    }
    if (filters.size) {
      sizeList.push(...filters.size.split(',').map((s) => s.trim()).filter(Boolean));
    }

    // 3. Normalize colors
    const colorList: string[] = [];
    if (filters.colors && Array.isArray(filters.colors)) {
      colorList.push(...filters.colors);
    }
    if (filters.color) {
      colorList.push(...filters.color.split(',').map((c) => c.trim()).filter(Boolean));
    }

    // 4. Construct Where clause
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(categoryIds !== undefined && { categoryId: { in: categoryIds } }),
      ...(filters.groupId !== undefined && { groupId: filters.groupId }),
      ...(filters.colorId !== undefined && { colorId: filters.colorId }),
      ...(filters.isFeatured !== undefined && { isFeatured: filters.isFeatured }),
      ...(filters.isPrimary !== undefined
        ? { isPrimary: filters.isPrimary }
        : colorList.length > 0
        ? {}
        : { isPrimary: true }),
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
      ...(sizeList.length > 0
        ? {
            variants: {
              some: {
                isActive: true,
                deletedAt: null,
                OR: [
                  { size: { value: { in: sizeList, mode: 'insensitive' } } },
                  { sizeId: { in: sizeList } },
                ],
              },
            },
          }
        : {}),
      ...(colorList.length > 0
        ? {
            OR: [
              { color: { value: { in: colorList, mode: 'insensitive' } } },
              { colorCode: { in: colorList, mode: 'insensitive' } },
              { colorId: { in: colorList } },
            ],
          }
        : {}),
    };

    // 5. Construct OrderBy
    let orderBy: Prisma.ProductOrderByWithRelationInput[] = [];
    const sortBy = filters.sortBy?.toLowerCase();

    if (sortBy === 'price-asc' || sortBy === 'price_asc' || sortBy === 'price_low_high') {
      orderBy = [{ basePrice: 'asc' }];
    } else if (sortBy === 'price-desc' || sortBy === 'price_desc' || sortBy === 'price_high_low') {
      orderBy = [{ basePrice: 'desc' }];
    } else if (sortBy === 'newest' || sortBy === 'created_at') {
      orderBy = [{ createdAt: 'desc' }];
    } else if (sortBy === 'name-asc' || sortBy === 'name_asc') {
      orderBy = [{ name: 'asc' }];
    } else if (sortBy === 'name-desc' || sortBy === 'name_desc') {
      orderBy = [{ name: 'desc' }];
    } else if (sortBy === 'featured') {
      orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
    } else if (filters.sortBy) {
      orderBy = [{ [filters.sortBy]: filters.order ?? 'desc' }];
    } else {
      orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
    }

    // 6. Query DB
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
              parent: { select: { id: true, name: true, slug: true } },
            },
          },
          color: { select: { id: true, value: true, colorCode: true } },
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
              products: {
                where: { deletedAt: null, isActive: true },
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  colorCode: true,
                  isPrimary: true,
                  isActive: true,
                  color: { select: { id: true, value: true, colorCode: true } },
                  images: {
                    take: 1,
                    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                    select: { url: true, altText: true },
                  },
                },
              },
            },
          },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          variants: {
            where: { isActive: true, deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
            include: {
              size: { select: { id: true, value: true, sortOrder: true, orderList: true } },
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

  async getPublicProductFilters(categoryIdentifier?: string) {
    let categoryIds: string[] | undefined = undefined;
    let targetCategory: any = null;

    if (categoryIdentifier) {
      targetCategory = await prisma.category.findFirst({
        where: {
          OR: [
            { slug: categoryIdentifier },
            { id: categoryIdentifier },
            ...(categoryIdentifier === 'women' ? [{ slug: 'womens-wear' }] : []),
            ...(categoryIdentifier === 'men' ? [{ slug: 'mens-wear' }] : []),
            ...(categoryIdentifier === 'kids' ? [{ slug: 'kids-festive' }] : []),
          ],
          isActive: true,
        },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              slug: true,
              imageUrl: true,
              description: true,
              metaTitle: true,
              _count: { select: { products: true } },
            },
          },
        },
      });

      if (targetCategory) {
        const ids = new Set<string>();
        ids.add(targetCategory.id);
        targetCategory.children.forEach((c: any) => ids.add(c.id));
        categoryIds = Array.from(ids);
      }
    }

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    };

    const [priceStats, colors, sizes] = await Promise.all([
      prisma.product.aggregate({
        where,
        _min: { basePrice: true },
        _max: { basePrice: true },
        _count: true,
      }),
      prisma.attributeValue.findMany({
        where: {
          attribute: { name: 'Color' },
          productsWithColor: {
            some: where,
          },
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          value: true,
          colorCode: true,
          _count: {
            select: {
              productsWithColor: { where },
            },
          },
        },
      }),
      prisma.attributeValue.findMany({
        where: {
          attribute: { name: 'Size' },
          variantsWithSize: {
            some: {
              isActive: true,
              deletedAt: null,
              product: where,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          value: true,
          sortOrder: true,
          orderList: true,
          _count: {
            select: {
              variantsWithSize: {
                where: {
                  isActive: true,
                  deletedAt: null,
                  product: where,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      category: targetCategory
        ? {
            id: targetCategory.id,
            name: targetCategory.name,
            slug: targetCategory.slug,
            description: targetCategory.description,
            imageUrl: targetCategory.imageUrl,
            metaTitle: targetCategory.metaTitle,
            subcategories: targetCategory.children.map((sub: any) => ({
              id: sub.id,
              name: sub.name,
              slug: sub.slug,
              imageUrl: sub.imageUrl,
              description: sub.description,
              metaTitle: sub.metaTitle,
              count: sub._count?.products ?? 0,
            })),
          }
        : null,
      priceRange: {
        min: priceStats._min.basePrice ? Number(priceStats._min.basePrice) : 0,
        max: priceStats._max.basePrice ? Number(priceStats._max.basePrice) : 0,
      },
      colors: colors.map((c) => ({
        id: c.id,
        name: c.value,
        colorCode: c.colorCode,
        count: c._count.productsWithColor,
      })),
      sizes: sizes.map((s) => ({
        id: s.id,
        name: s.value,
        sortOrder: s.sortOrder,
        count: s._count.variantsWithSize,
      })),
      totalProducts: priceStats._count,
    };
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
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
              include: {
                color: true,
                images: {
                  take: 1,
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                },
              },
            },
          },
        },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: {
          where: { isActive: true, deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
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
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
              include: {
                color: true,
                images: {
                  take: 1,
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                },
              },
            },
          },
        },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: {
          where: { isActive: true, deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
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
        include: { values: { orderBy: { sortOrder: 'asc' } } },
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

