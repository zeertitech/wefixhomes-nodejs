import { FastifyRequest, FastifyReply } from 'fastify';
import { productService } from '../services/product.service';
import { storageService } from '../services/storage.service';
import { prisma } from '../config/prisma';
import {
  createProductSchema,
  updateProductSchema,
  cloneColourSchema,
  reorderImagesSchema,
  productFilterSchema,
} from '../validators/product.validator';
import { sendSuccess, sendCreated, paginationMeta } from '../lib/response';
import { NotFoundError } from '../lib/errors';
import type { MultipartFile } from '@fastify/multipart';
import { env } from '../config/env';

function formatProductImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const fileName = url.includes('/') ? url.split('/').pop()! : url;
  const baseUrl = env.R2_PUBLIC_URL.replace(/\/+$/, '');
  const folder = env.R2_PUBLIC_FOLDER_PRODUCT.replace(/^\/+|\/+$/g, '');
  return `${baseUrl}/${folder}/${fileName}`;
}

function formatProduct<T>(product: T): T {
  if (!product || typeof product !== 'object') return product;
  const p = product as any;
  return {
    ...p,
    images: p.images?.map((img: any) => ({
      ...img,
      url: formatProductImageUrl(img.url),
    })),
    group: p.group
      ? {
          ...p.group,
          products: p.group.products?.map((gp: any) => ({
            ...gp,
            images: gp.images?.map((gi: any) => ({
              ...gi,
              url: formatProductImageUrl(gi.url),
            })),
          })),
        }
      : undefined,
  };
}

export class ProductController {
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const filters = productFilterSchema.parse(request.query);
    const { items, total } = await productService.list(filters);
    const formatted = items.map((item: any) => formatProduct(item));
    sendSuccess(
      reply,
      formatted,
      'Products fetched',
      200,
      paginationMeta(filters.page, filters.limit, total)
    );
  }

  async getBySlug(
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const product = await productService.getBySlug(request.params.slug);
    sendSuccess(reply, formatProduct(product), 'Product fetched');
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const product = await productService.getById(request.params.id);
    sendSuccess(reply, formatProduct(product), 'Product fetched');
  }

  async getAttributes(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const attributes = await productService.getAttributes();
    sendSuccess(reply, attributes, 'Attributes fetched');
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createProductSchema.parse(request.body);
    const product = await productService.create(input, request.user!.userId);
    sendCreated(reply, formatProduct(product), 'Product created');
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = updateProductSchema.parse(request.body);
    const product = await productService.update(request.params.id, input, request.user!.userId);
    sendSuccess(reply, formatProduct(product), 'Product updated');
  }

  async highlightPrimary(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const product = await productService.highlightPrimary(request.params.id, request.user!.userId);
    sendSuccess(reply, formatProduct(product), 'Product highlighted as primary');
  }

  async cloneColour(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = cloneColourSchema.parse(request.body);
    const product = await productService.cloneColour(
      request.params.id,
      input,
      request.user!.userId
    );
    sendCreated(reply, formatProduct(product), 'New colour added to product group');
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    await productService.delete(request.params.id, request.user!.userId);
    sendSuccess(reply, null, 'Product deleted');
  }

  async uploadImages(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const product = await productService.getById(request.params.id);
    if (!product) throw new NotFoundError('Product');

    const parts = request.parts();
    const urls: string[] = [];
    const existingCount = await prisma.productImage.count({
      where: { productId: request.params.id },
    });
    const hasPrimary = await prisma.productImage.findFirst({
      where: { productId: request.params.id, isPrimary: true },
    });

    let index = 0;
    for await (const part of parts) {
      if (part.type === 'file') {
        const file = part as MultipartFile;
        const buffer = await file.toBuffer();
        const fileName = await storageService.upload(
          buffer,
          file.filename,
          file.mimetype,
          env.R2_PUBLIC_FOLDER_PRODUCT,
          product.name
        );

        const isPrimary = !hasPrimary && index === 0;

        await prisma.productImage.create({
          data: {
            productId: request.params.id,
            url: fileName,
            altText: product.name,
            isPrimary,
            sortOrder: existingCount + index,
          },
        });

        urls.push(formatProductImageUrl(fileName));
        index++;
      }
    }

    const updatedImages = await prisma.productImage.findMany({
      where: { productId: request.params.id },
      orderBy: { sortOrder: 'asc' },
    });

    sendSuccess(
      reply,
      updatedImages.map((img) => ({ ...img, url: formatProductImageUrl(img.url) })),
      'Images uploaded',
      201
    );
  }

  async reorderImages(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = reorderImagesSchema.parse(request.body);
    const updated = await productService.reorderImages(request.params.id, input);
    sendSuccess(reply, formatProduct(updated), 'Images reordered');
  }

  async deleteImage(
    request: FastifyRequest<{ Params: { id: string; imageId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const image = await prisma.productImage.findFirst({
      where: { id: request.params.imageId, productId: request.params.id },
    });

    if (!image) throw new NotFoundError('Image');

    await storageService.delete(image.url, env.R2_PUBLIC_FOLDER_PRODUCT).catch(() => {});
    await prisma.productImage.delete({ where: { id: image.id } });

    // If deleted image was primary, set next image as primary
    if (image.isPrimary) {
      const nextImg = await prisma.productImage.findFirst({
        where: { productId: request.params.id },
        orderBy: { sortOrder: 'asc' },
      });
      if (nextImg) {
        await prisma.productImage.update({
          where: { id: nextImg.id },
          data: { isPrimary: true },
        });
      }
    }

    sendSuccess(reply, null, 'Image deleted');
  }
}

export const productController = new ProductController();
