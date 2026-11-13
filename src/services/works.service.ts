import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { auditService } from './audit.service';
import { releaseImage } from './catalogue.service';
import { storageService } from './storage.service';
import { slugFromName } from '../utils/slug';
import type { AdminWorkQuery, CreateWorkInput, PublicWorkQuery, UpdateWorkInput } from '../validators/works.validator';

const workInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.WorkInclude;

type WorkRecord = Prisma.WorkGetPayload<{ include: typeof workInclude }>;

const publicCategory = { isActive: true, deletedAt: null } as const;
const imageUrl = (key: string | null) => storageService.deliveryUrl(key, 'service');
const isoDate = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

function altFor(work: WorkRecord): string {
  return `${work.title} — ${work.category.name} project`;
}

function listDto(work: WorkRecord) {
  return {
    id: work.id,
    slug: work.slug,
    title: work.title,
    shortDescription: work.shortDescription,
    coverImageUrl: imageUrl(work.coverImage),
    coverImageAlt: altFor(work),
    location: work.location,
    propertyType: work.propertyType,
    completedAt: isoDate(work.completionDate),
    isFeatured: work.isFeatured,
    sortOrder: work.sortOrder,
    category: work.category,
  };
}

function imageDto(image: WorkRecord['images'][number], work: WorkRecord) {
  return {
    id: image.id,
    imageUrl: imageUrl(image.imageKey),
    altText: image.altText || altFor(work),
    kind: image.kind,
  };
}

function publicDetailDto(work: WorkRecord) {
  return {
    ...listDto(work),
    description: work.description,
    seoTitle: work.seoTitle,
    seoDescription: work.seoDescription,
    seoKeywords: work.seoKeywords,
    galleryImages: work.images.filter((image) => image.kind === 'GALLERY').map((image) => imageDto(image, work)),
    beforeImage: work.images.filter((image) => image.kind === 'BEFORE').map((image) => imageDto(image, work))[0] ?? null,
    afterImage: work.images.filter((image) => image.kind === 'AFTER').map((image) => imageDto(image, work))[0] ?? null,
  };
}

function adminDto(work: WorkRecord) {
  return {
    id: work.id,
    title: work.title,
    slug: work.slug,
    categoryId: work.categoryId,
    category: work.category,
    shortDescription: work.shortDescription,
    description: work.description,
    coverImage: work.coverImage,
    coverImageUrl: imageUrl(work.coverImage),
    location: work.location,
    propertyType: work.propertyType,
    completionDate: isoDate(work.completionDate),
    isFeatured: work.isFeatured,
    sortOrder: work.sortOrder,
    status: work.status,
    seoTitle: work.seoTitle,
    seoDescription: work.seoDescription,
    seoKeywords: work.seoKeywords,
    publishedAt: work.publishedAt,
    createdAt: work.createdAt,
    updatedAt: work.updatedAt,
    images: work.images.map((image) => ({
      id: image.id,
      imageKey: image.imageKey,
      imageUrl: imageUrl(image.imageKey),
      altText: image.altText,
      kind: image.kind,
      sortOrder: image.sortOrder,
    })),
  };
}

function rethrowWrite(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictError('That URL slug is already in use');
  }
  throw error;
}

function dateValue(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function requireCoverToPublish(status: string, cover: string | null): void {
  if (status === 'PUBLISHED' && !cover) {
    throw new ValidationError('Add a cover image before publishing', { coverImage: ['Add a cover image before publishing'] });
  }
}

/** Confirms each newly referenced file exists in storage and is a real image. Files already on this work are trusted. */
async function verifyNewImages(keys: string[], known: Set<string>): Promise<void> {
  for (const key of new Set(keys)) {
    if (!known.has(key)) await storageService.verifyUploadedImage(key, 'service');
  }
}

function usedKeys(work: { coverImage: string | null; images: { imageKey: string }[] }): string[] {
  return [...new Set([...(work.coverImage ? [work.coverImage] : []), ...work.images.map((image) => image.imageKey)])];
}

async function releaseRemoved(before: string[], after: string[]): Promise<void> {
  const keep = new Set(after);
  for (const key of before) if (!keep.has(key)) await releaseImage(key, 'service');
}

export class WorksService {
  async listPublic(query: PublicWorkQuery) {
    const where: Prisma.WorkWhereInput = {
      status: 'PUBLISHED',
      category: query.category ? { ...publicCategory, slug: query.category } : publicCategory,
    };
    if (query.featured !== undefined) where.isFeatured = query.featured;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await prisma.$transaction([
      prisma.work.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [
          { sortOrder: query.order },
          { completionDate: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        include: workInclude,
      }),
      prisma.work.count({ where }),
    ]);
    return { total, works: rows.map(listDto) };
  }

  async getPublic(slug: string) {
    const work = await prisma.work.findFirst({
      where: { slug, status: 'PUBLISHED', category: publicCategory },
      include: workInclude,
    });
    if (!work) throw new NotFoundError('Project');
    const related = await prisma.work.findMany({
      where: { status: 'PUBLISHED', categoryId: work.categoryId, id: { not: work.id }, category: publicCategory },
      orderBy: [{ sortOrder: 'asc' }, { completionDate: { sort: 'desc', nulls: 'last' } }],
      take: 3,
      include: workInclude,
    });
    return { ...publicDetailDto(work), related: related.map(listDto) };
  }

  async listAdmin(query: AdminWorkQuery) {
    const where: Prisma.WorkWhereInput = {};
    if (query.status !== 'all') where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.featured !== undefined) where.isFeatured = query.featured;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const orderBy: Prisma.WorkOrderByWithRelationInput[] =
      query.sortBy === 'completionDate'
        ? [{ completionDate: { sort: query.order, nulls: 'last' } }]
        : [{ [query.sortBy]: query.order }];
    const [rows, total] = await prisma.$transaction([
      prisma.work.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [...orderBy, { title: 'asc' }],
        include: workInclude,
      }),
      prisma.work.count({ where }),
    ]);
    return { total, works: rows.map(adminDto) };
  }

  async getAdmin(id: string) {
    const work = await prisma.work.findUnique({ where: { id }, include: workInclude });
    if (!work) throw new NotFoundError('Project');
    return adminDto(work);
  }

  async create(input: CreateWorkInput, userId: string, ipAddress?: string) {
    const category = await prisma.serviceCategory.findFirst({ where: { id: input.categoryId, deletedAt: null }, select: { id: true } });
    if (!category) throw new NotFoundError('Category');
    const slug = input.slug || slugFromName(input.title);
    if (!slug) throw new BusinessError('Enter a title that can be used in a URL');
    const cover = input.coverImage ?? null;
    const images = input.images ?? [];
    requireCoverToPublish(input.status, cover);
    await verifyNewImages([...(cover ? [cover] : []), ...images.map((image) => image.imageKey)], new Set());
    try {
      const work = await prisma.work.create({
        data: {
          categoryId: input.categoryId,
          title: input.title,
          slug,
          shortDescription: input.shortDescription,
          description: input.description,
          coverImage: cover,
          location: input.location,
          propertyType: input.propertyType,
          completionDate: dateValue(input.completionDate) ?? null,
          isFeatured: input.isFeatured,
          sortOrder: input.sortOrder,
          status: input.status,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          seoKeywords: input.seoKeywords,
          publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
          images: {
            create: images.map((image, index) => ({ imageKey: image.imageKey, altText: image.altText, kind: image.kind, sortOrder: index })),
          },
        },
        include: workInclude,
      });
      await auditService.log('Work', work.id, 'CREATE', null, { title: work.title, slug, status: work.status }, userId, userId, ipAddress);
      return adminDto(work);
    } catch (error) {
      await releaseRemoved([...(cover ? [cover] : []), ...images.map((image) => image.imageKey)], []);
      rethrowWrite(error);
    }
  }

  async update(id: string, input: UpdateWorkInput, userId: string, ipAddress?: string) {
    const existing = await prisma.work.findUnique({ where: { id }, include: workInclude });
    if (!existing) throw new NotFoundError('Project');
    if (input.categoryId) {
      const category = await prisma.serviceCategory.findFirst({ where: { id: input.categoryId, deletedAt: null }, select: { id: true } });
      if (!category) throw new NotFoundError('Category');
    }
    const nextCover = input.coverImage !== undefined ? input.coverImage : existing.coverImage;
    const nextStatus = input.status ?? existing.status;
    requireCoverToPublish(nextStatus, nextCover);
    const before = usedKeys(existing);
    const nextImages = input.images;
    await verifyNewImages(
      [...(nextCover ? [nextCover] : []), ...(nextImages ?? []).map((image) => image.imageKey)],
      new Set(before),
    );
    const newlyAdded = [...(nextCover ? [nextCover] : []), ...(nextImages ?? []).map((image) => image.imageKey)].filter((key) => !before.includes(key));
    try {
      const work = await prisma.$transaction(async (tx) => {
        if (nextImages) {
          await tx.workImage.deleteMany({ where: { workId: id } });
          await tx.workImage.createMany({
            data: nextImages.map((image, index) => ({ workId: id, imageKey: image.imageKey, altText: image.altText, kind: image.kind, sortOrder: index })),
          });
        }
        return tx.work.update({
          where: { id },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
            ...(input.shortDescription !== undefined ? { shortDescription: input.shortDescription } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
            ...(input.location !== undefined ? { location: input.location } : {}),
            ...(input.propertyType !== undefined ? { propertyType: input.propertyType } : {}),
            ...(input.completionDate !== undefined ? { completionDate: dateValue(input.completionDate) } : {}),
            ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.status === 'PUBLISHED' && !existing.publishedAt ? { publishedAt: new Date() } : {}),
            ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
            ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
            ...(input.seoKeywords !== undefined ? { seoKeywords: input.seoKeywords } : {}),
          },
          include: workInclude,
        });
      });
      await releaseRemoved(before, usedKeys(work));
      await auditService.log(
        'Work',
        id,
        'UPDATE',
        { title: existing.title, slug: existing.slug, status: existing.status, isFeatured: existing.isFeatured },
        { title: work.title, slug: work.slug, status: work.status, isFeatured: work.isFeatured },
        userId,
        userId,
        ipAddress,
      );
      return adminDto(work);
    } catch (error) {
      await releaseRemoved(newlyAdded, []);
      rethrowWrite(error);
    }
  }

  async delete(id: string, userId: string, ipAddress?: string) {
    const existing = await prisma.work.findUnique({ where: { id }, include: workInclude });
    if (!existing) throw new NotFoundError('Project');
    await prisma.work.delete({ where: { id } });
    await releaseRemoved(usedKeys(existing), []);
    await auditService.log('Work', id, 'DELETE', { title: existing.title, slug: existing.slug }, null, userId, userId, ipAddress);
    return { id, deleted: true };
  }
}

export const worksService = new WorksService();
