import { FastifyRequest, FastifyReply } from 'fastify';
import { productService } from '../services/product.service';
import { storageService } from '../services/storage.service';
import { prisma } from '../config/prisma';
import {
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
} from '../validators/product.validator';
import { sendSuccess, paginationMeta } from '../lib/response';
import { NotFoundError } from '../lib/errors';
import type { MultipartFile } from '@fastify/multipart';
import { env } from '../config/env';

export class ProductController {
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const filters = productFilterSchema.parse(request.query);
    const { items, total } = await productService.list(filters);
    sendSuccess(
      reply,
      items,
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
    sendSuccess(reply, product, 'Product fetched');
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createProductSchema.parse(request.body);
    const product = await productService.create(input, request.user!.userId);
    sendSuccess(reply, product, 'Product created', 201);
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = updateProductSchema.parse(request.body);
    const product = await productService.update(request.params.id, input, request.user!.userId);
    sendSuccess(reply, product, 'Product updated');
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
    let isFirst = true;

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

        // First uploaded image becomes primary if none exists
        const hasExisting = await prisma.productImage.findFirst({
          where: { productId: request.params.id, isPrimary: true },
        });

        await prisma.productImage.create({
          data: {
            productId: request.params.id,
            url: fileName,
            altText: product.name,
            isPrimary: isFirst && hasExisting === null,
            sortOrder: urls.length,
          },
        });

        urls.push(fileName);
        isFirst = false;
      }
    }

    sendSuccess(reply, { uploaded: urls.length, urls }, 'Images uploaded', 201);
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

    sendSuccess(reply, null, 'Image deleted');
  }
}

export const productController = new ProductController();
