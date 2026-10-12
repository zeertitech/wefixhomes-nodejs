import { FastifyRequest, FastifyReply } from 'fastify';
import { productService } from '../services/product.service';
import { env } from '../config/env';
import {
  publicProductFilterSchema,
  publicProductFacetFilterSchema,
} from '../validators/product.validator';
import { sendSuccess, paginationMeta } from '../lib/response';

export function formatProductImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const fileName = url.includes('/') ? url.split('/').pop()! : url;
  const baseUrl = env.R2_PUBLIC_URL.replace(/\/+$/, '');
  const folder = env.R2_PUBLIC_FOLDER_PRODUCT.replace(/^\/+|\/+$/g, '');
  return `${baseUrl}/${folder}/${fileName}`;
}

export function formatPublicProduct(product: any): any {
  if (!product || typeof product !== 'object') return product;

  const images = (product.images || []).map((img: any) => ({
    ...img,
    url: formatProductImageUrl(img.url),
  }));

  const primaryImage =
    images.find((img: any) => img.isPrimary)?.url || images[0]?.url || '';
  const secondaryImage =
    images.length > 1
      ? (images.find((img: any) => !img.isPrimary)?.url || images[1]?.url || '')
      : primaryImage;

  const basePriceNum = Number(product.basePrice) || 0;
  const comparePriceNum =
    product.comparePrice != null ? Number(product.comparePrice) : null;
  const discountPercent =
    comparePriceNum && comparePriceNum > basePriceNum
      ? Math.round(((comparePriceNum - basePriceNum) / comparePriceNum) * 100)
      : 0;

  const variants = (product.variants || []).map((v: any) => ({
    ...v,
    price: Number(v.price) || 0,
    comparePrice: v.comparePrice != null ? Number(v.comparePrice) : null,
    inventory: v.inventory
      ? {
          quantity: v.inventory.quantity ?? 0,
          lowStockAt: v.inventory.lowStockAt ?? 5,
        }
      : null,
  }));

  const currentMinVariantPrice =
    variants.length > 0 ? Math.min(...variants.map((v: any) => v.price)) : null;

  // Format sibling colors from product group
  let siblingColors: any[] = [];
  if (product.group?.products && Array.isArray(product.group.products)) {
    siblingColors = product.group.products.map((gp: any) => {
      const gpImg = gp.images?.[0]?.url ? formatProductImageUrl(gp.images[0].url) : null;
      const gpBasePrice = gp.basePrice != null ? Number(gp.basePrice) : null;
      const gpComparePrice = gp.comparePrice != null ? Number(gp.comparePrice) : null;
      const gpVariants = (gp.variants || []).map((v: any) => ({
        ...v,
        price: Number(v.price) || 0,
        comparePrice: v.comparePrice != null ? Number(v.comparePrice) : null,
      }));
      const minVariantPrice =
        gpVariants.length > 0 ? Math.min(...gpVariants.map((v: any) => v.price)) : null;
      const effectivePrice = minVariantPrice ?? gpBasePrice;

      return {
        productId: gp.id,
        name: gp.name,
        slug: gp.slug,
        basePrice: gpBasePrice,
        comparePrice: gpComparePrice,
        price: effectivePrice,
        variants: gpVariants,
        colorId: gp.color?.id || null,
        colorName: gp.color?.value || null,
        colorCode: gp.colorCode || gp.color?.colorCode || null,
        isPrimary: gp.isPrimary,
        isCurrent: gp.id === product.id,
        imageUrl: gpImg,
      };
    });
  }

  // Ensure current product's color is in siblingColors if empty
  if (siblingColors.length === 0 && product.color) {
    siblingColors = [
      {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        basePrice: basePriceNum,
        comparePrice: comparePriceNum,
        price: currentMinVariantPrice ?? basePriceNum,
        variants,
        colorId: product.color.id,
        colorName: product.color.value,
        colorCode: product.colorCode || product.color.colorCode || null,
        isPrimary: product.isPrimary ?? true,
        isCurrent: true,
        imageUrl: primaryImage,
      },
    ];
  }

  const uniqueSizes = Array.from(
    new Set(
      variants
        .map((v: any) => v.size?.value)
        .filter((val: any): val is string => Boolean(val))
    )
  );

  const inStock = variants.some((v: any) => (v.inventory?.quantity ?? 0) > 0);

  return {
    id: product.id,
    groupId: product.groupId,
    groupName: product.group?.name || product.name,
    groupSlug: product.group?.slug || null,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? null,
    description: product.description ?? null,
    basePrice: basePriceNum,
    comparePrice: comparePriceNum,
    discountPercent,
    isPrimary: product.isPrimary ?? false,
    isActive: product.isActive ?? true,
    isFeatured: product.isFeatured ?? false,
    isCustomisable: true,
    inStock,
    colorId: product.colorId,
    colorCode: product.colorCode || product.color?.colorCode || null,
    color: product.color
      ? {
          id: product.color.id,
          value: product.color.value,
          colorCode: product.colorCode || product.color.colorCode || null,
        }
      : null,
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug,
          parent: product.category.parent
            ? {
                id: product.category.parent.id,
                name: product.category.parent.name,
                slug: product.category.parent.slug,
              }
            : null,
        }
      : null,
    images,
    primaryImage,
    secondaryImage,
    colors: siblingColors,
    variants,
    sizes: uniqueSizes,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export class PublicProductController {
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.header('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300');
    const filters = publicProductFilterSchema.parse(request.query);
    const { items, total, facets } = (await productService.listPublic(filters)) as any;
    const formatted = items.map((item: any) => formatPublicProduct(item));

    sendSuccess(
      reply,
      formatted,
      'Public products fetched',
      200,
      {
        ...paginationMeta(filters.page, filters.limit, total),
        ...(facets !== undefined ? { facets } : {}),
      } as any
    );
  }

  async getFilters(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    const query = publicProductFacetFilterSchema.parse(request.query);
    const catQuery = query.categorySlug || query.category;
    const filterFacets = await productService.getPublicFilters(catQuery);
    sendSuccess(reply, filterFacets, 'Public product filters fetched');
  }

  async getBySlug(
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    const product = await productService.getBySlug(request.params.slug);
    sendSuccess(reply, formatPublicProduct(product), 'Public product fetched');
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    const product = await productService.getById(request.params.id);
    sendSuccess(reply, formatPublicProduct(product), 'Public product fetched');
  }
}

export const publicProductController = new PublicProductController();
