import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess } from '../lib/response';
import { NotFoundError, ConflictError, BusinessError } from '../lib/errors';
import { storageService } from '../services/storage.service';
import { env } from '../config/env';

import slugify from 'slugify';
import crypto from 'crypto';

const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  slug: z.string().optional().nullable().transform((v) => (v && v.trim() ? v.trim() : undefined)),
  description: z.string().optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  parentId: z.string().optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  imageUrl: z.string().optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  metaTitle: z.string().max(255).optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  metaDescription: z.string().max(500).optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  keywords: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
      return val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    })
    .default([]),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().optional().nullable().transform((v) => (v && v.trim() ? v.trim() : undefined)),
  description: z.string().optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  parentId: z.string().optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  // imageUrl: only update if explicitly sent; undefined = "not in payload" = keep existing value in DB
  imageUrl: z.string().optional().nullable().transform((v) => {
    if (v === undefined) return undefined;
    return v && v.trim() ? v.trim() : null;
  }),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  metaTitle: z.string().max(255).optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  metaDescription: z.string().max(500).optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  keywords: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (!val) return [];
      if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
      return val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }),
});

async function createUniqueSlug(baseText: string): Promise<string> {
  const base = slugify(baseText, { lower: true, strict: true, trim: true }) || 'category';
  const existing = await prisma.category.findUnique({ where: { slug: base } });
  if (!existing) return base;
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

function formatCategoryImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || !imageUrl.trim()) return null;
  const fileName = imageUrl.includes('/') ? imageUrl.split('/').pop()! : imageUrl;
  const baseUrl = env.R2_PUBLIC_URL.replace(/\/+$/, '');
  const folder = env.R2_PUBLIC_FOLDER_CATEGORY.replace(/^\/+|\/+$/g, '');
  return `${baseUrl}/${folder}/${fileName}`;
}

function formatCategory<T extends { imageUrl?: string | null; children?: any[]; parent?: any }>(
  category: T
): T {
  return {
    ...category,
    imageUrl: formatCategoryImageUrl(category.imageUrl),
    ...(category.children
      ? { children: category.children.map((child: any) => formatCategory(child)) }
      : {}),
    ...(category.parent ? { parent: formatCategory(category.parent) } : {}),
  };
}

export class CategoryController {
  async list(
    request: FastifyRequest<{ Querystring: { nested?: string; tree?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { nested, tree } = (request.query || {}) as { nested?: string; tree?: string };
    const isNested = nested === 'true' || nested === '1' || tree === 'true' || tree === '1';

    if (!isNested) {
      // Default: Return flat list of all active categories (existing behavior preserved)
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          _count: { select: { products: true } },
        },
      });
      sendSuccess(reply, categories.map((cat) => formatCategory(cat)), 'Categories fetched');
      return;
    }

    // Nested: Build complete recursive category hierarchy tree
    const allCategories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });

    const categoryMap = new Map<string, any>();
    allCategories.forEach((cat) => {
      categoryMap.set(cat.id, {
        ...formatCategory(cat),
        children: [],
      });
    });

    const rootCategories: any[] = [];
    allCategories.forEach((cat) => {
      const formatted = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(formatted);
      } else {
        rootCategories.push(formatted);
      }
    });

    sendSuccess(reply, rootCategories, 'Nested categories fetched');
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const identifier = request.params.id;
    const category = await prisma.category.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      include: { children: true, parent: true },
    });
    if (!category) throw new NotFoundError('Category');
    sendSuccess(reply, formatCategory(category), 'Category fetched');
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createCategorySchema.parse(request.body);

    const existing = await prisma.category.findUnique({ where: { name: input.name } });
    if (existing) throw new ConflictError(`Category "${input.name}" already exists`);

    if (input.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundError('Parent category');
    }

    const slug = await createUniqueSlug(input.slug || input.name);
    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        parentId: input.parentId,
        imageUrl: input.imageUrl,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        metaTitle: input.metaTitle,
        metaDescription: input.metaDescription,
        keywords: input.keywords,
      },
    });

    sendSuccess(reply, formatCategory(category), 'Category created', 201);
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const existing = await prisma.category.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new NotFoundError('Category');

    const input = updateCategorySchema.parse(request.body);

    if (input.name && input.name !== existing.name) {
      const nameConflict = await prisma.category.findUnique({ where: { name: input.name } });
      if (nameConflict) throw new ConflictError(`Category "${input.name}" already exists`);
    }

    if (input.parentId) {
      if (input.parentId === existing.id) {
        throw new BusinessError('Category cannot be its own parent');
      }
      const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundError('Parent category');
    }

    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      slug = await createUniqueSlug(input.slug);
    }

    const category = await prisma.category.update({
      where: { id: request.params.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.metaTitle !== undefined && { metaTitle: input.metaTitle }),
        ...(input.metaDescription !== undefined && { metaDescription: input.metaDescription }),
        ...(input.keywords !== undefined && { keywords: input.keywords }),
      },
    });

    sendSuccess(reply, formatCategory(category), 'Category updated');
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const existing = await prisma.category.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new NotFoundError('Category');

    await prisma.category.update({
      where: { id: request.params.id },
      data: { isActive: false },
    });

    sendSuccess(reply, null, 'Category deactivated');
  }

  async uploadImage(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const category = await prisma.category.findUnique({ where: { id: request.params.id } });
    if (!category) throw new NotFoundError('Category');

    const file = await request.file();
    if (!file) throw new BusinessError('Image file is required');

    const buffer = await file.toBuffer();
    const fileName = await storageService.upload(
      buffer,
      file.filename,
      file.mimetype,
      env.R2_PUBLIC_FOLDER_CATEGORY,
      category.name
    );

    // Remove existing image from R2 if present
    if (category.imageUrl) {
      await storageService.delete(category.imageUrl, env.R2_PUBLIC_FOLDER_CATEGORY).catch(() => {});
    }

    const updated = await prisma.category.update({
      where: { id: category.id },
      data: { imageUrl: fileName },
    });

    sendSuccess(reply, formatCategory(updated), 'Category image uploaded', 201);
  }

  async deleteImage(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const category = await prisma.category.findUnique({ where: { id: request.params.id } });
    if (!category) throw new NotFoundError('Category');

    if (category.imageUrl) {
      await storageService.delete(category.imageUrl, env.R2_PUBLIC_FOLDER_CATEGORY).catch(() => {});
      await prisma.category.update({
        where: { id: category.id },
        data: { imageUrl: null },
      });
    }

    sendSuccess(reply, null, 'Category image deleted');
  }
}

export const categoryController = new CategoryController();
