import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { auditService } from './audit.service';
import { storageService } from './storage.service';
import { decimalToAmount, offerPercent, parseMoney } from '../utils/money';
import type { ImagePurpose } from '../utils/object-key';
import { slugFromName } from '../utils/slug';
import type {
  AdminCategoryQuery,
  AdminServiceQuery,
  AdminLabelQuery,
  CreateCategoryInput,
  CreateLabelInput,
  CreateServiceInput,
  PublicCategoryQuery,
  PublicCategoryServicesQuery,
  PublicServiceQuery,
  UpdateCategoryInput,
  UpdateLabelInput,
  UpdateServiceInput,
} from '../validators/catalogue.validator';

const categoryOrderFields = {
  sortOrder: 'sortOrder',
  name: 'name',
  createdAt: 'createdAt',
} as const;

const serviceOrderFields = {
  sortOrder: 'sortOrder',
  name: 'name',
  createdAt: 'createdAt',
  sellingPrice: 'sellingPrice',
} as const;

const serviceInclude = {
  category: true,
  labels: { include: { label: true } },
} as const;

type ServiceRecord = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;

type LabelRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function priceFields(mrp: Prisma.Decimal | string, selling: Prisma.Decimal | string) {
  const mrpAmount = decimalToAmount(mrp);
  const sellingAmount = decimalToAmount(selling);
  const mrpMoney = parseMoney(mrpAmount);
  const sellingMoney = parseMoney(sellingAmount);
  return {
    mrp: mrpAmount,
    sellingPrice: sellingAmount,
    offerPercent:
      mrpMoney && sellingMoney ? offerPercent(mrpMoney.paise, sellingMoney.paise) : null,
  };
}

/** Public and admin category payload. `note` is the short line on cards and the category header. SEO fields are the search title, description, and keywords. */
function categoryDto(category: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  note: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  imageKey: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}, scope: 'public' | 'admin') {
  const base = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    note: category.note,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    seoKeywords: category.seoKeywords,
    imageUrl: storageService.deliveryUrl(category.imageKey, 'category'),
    sortOrder: category.sortOrder,
    isFeatured: category.isFeatured,
  };
  if (scope === 'public') return base;
  return { ...base, isActive: category.isActive, createdAt: category.createdAt, updatedAt: category.updatedAt };
}

function labelDto(label: LabelRecord, scope: 'public' | 'admin') {
  const base = {
    id: label.id,
    name: label.name,
    slug: label.slug,
    description: label.description,
    sortOrder: label.sortOrder,
  };
  if (scope === 'public') return base;
  return { ...base, isActive: label.isActive, createdAt: label.createdAt, updatedAt: label.updatedAt };
}

function assignedLabels(service: ServiceRecord, scope: 'public' | 'admin') {
  return service.labels
    .map((row) => row.label)
    .filter((label) => scope === 'admin' || label.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((label) => labelDto(label, scope));
}

function serviceDto(service: ServiceRecord, scope: 'public' | 'admin') {
  const prices = priceFields(service.mrp, service.sellingPrice);
  const base = {
    id: service.id,
    name: service.name,
    slug: service.slug,
    shortDescription: service.shortDescription,
    description: service.description,
    imageUrl: storageService.deliveryUrl(service.imageKey, 'service'),
    sortOrder: service.sortOrder,
    ...prices,
    labels: assignedLabels(service, scope),
    category: {
      id: service.category.id,
      name: service.category.name,
      slug: service.category.slug,
      sortOrder: service.category.sortOrder,
    },
  };
  if (scope === 'public') return base;
  return {
    ...base,
    categoryId: service.categoryId,
    isActive: service.isActive,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

const activeLabelOrder = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }];

async function resolveLabelAssignment(
  tx: Prisma.TransactionClient,
  categoryId: string,
  labelIds: string[] | undefined,
): Promise<string[] | undefined> {
  if (labelIds === undefined) return undefined;
  if (new Set(labelIds).size !== labelIds.length) {
    throw new ValidationError('Choose each label only once', { labelIds: ['Choose each label only once'] });
  }
  if (labelIds.length === 0) return [];
  const rows = await tx.categoryLabel.findMany({
    where: { id: { in: labelIds } },
    select: { id: true, categoryId: true, isActive: true },
  });
  if (rows.length !== labelIds.length) {
    throw new ValidationError('One or more labels were not found', { labelIds: ['One or more labels were not found'] });
  }
  if (rows.some((row) => row.categoryId !== categoryId)) {
    throw new ValidationError('Labels must belong to the selected category', {
      labelIds: ['Labels must belong to the selected category'],
    });
  }
  if (rows.some((row) => !row.isActive)) {
    throw new ValidationError('Only active labels can be assigned', { labelIds: ['Only active labels can be assigned'] });
  }
  return labelIds;
}

async function replaceServiceLabels(tx: Prisma.TransactionClient, serviceId: string, labelIds: string[]): Promise<void> {
  await tx.serviceLabel.deleteMany({ where: { serviceId } });
  if (labelIds.length === 0) return;
  await tx.serviceLabel.createMany({
    data: labelIds.map((labelId) => ({ serviceId, labelId })),
  });
}

async function imageStillUsed(imageKey: string, except?: { categoryId?: string; serviceId?: string }): Promise<boolean> {
  const fileName = imageKey.includes('/') ? imageKey.slice(imageKey.lastIndexOf('/') + 1) : imageKey;
  const folders = storageService.folders();
  const keys = [...new Set([imageKey, fileName, `${folders.category}/${fileName}`, `${folders.service}/${fileName}`])];
  const [categories, services] = await prisma.$transaction([
    prisma.serviceCategory.count({
      where: {
        imageKey: { in: keys },
        ...(except?.categoryId ? { id: { not: except.categoryId } } : {}),
      },
    }),
    prisma.service.count({
      where: {
        imageKey: { in: keys },
        ...(except?.serviceId ? { id: { not: except.serviceId } } : {}),
      },
    }),
  ]);
  return categories + services > 0;
}

async function releaseImage(
  imageKey: string | null,
  purpose: ImagePurpose,
  except?: { categoryId?: string; serviceId?: string }
): Promise<void> {
  if (!imageKey) return;
  if (await imageStillUsed(imageKey, except)) return;
  await storageService.deleteCatalogueImage(imageKey, purpose);
}

function rethrowWrite(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictError('That URL slug is already in use');
  }
  throw error;
}

async function resolveImage(imageKey: string | null | undefined, purpose: ImagePurpose): Promise<{
  imageKey: string | null;
  imageUrl: string | null;
} | undefined> {
  if (imageKey === undefined) return undefined;
  if (imageKey === null) return { imageKey: null, imageUrl: null };
  const verified = await storageService.verifyUploadedImage(imageKey, purpose);
  return verified;
}

function sameImage(left: string | null, right: string | null): boolean {
  if (!left || !right) return left === right;
  const leftName = left.includes('/') ? left.slice(left.lastIndexOf('/') + 1) : left;
  const rightName = right.includes('/') ? right.slice(right.lastIndexOf('/') + 1) : right;
  return leftName === rightName;
}

export class CatalogueService {
  async listPublicCategories(query: PublicCategoryQuery) {
    const where: Prisma.ServiceCategoryWhereInput = { isActive: true, deletedAt: null };
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    const orderField = categoryOrderFields[query.sortBy];
    const [rows, total] = await prisma.$transaction([
      prisma.serviceCategory.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [orderField]: query.order }, { name: 'asc' }],
        include: {
          labels: { where: { isActive: true }, orderBy: activeLabelOrder },
          services: {
            where: { isActive: true, deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: serviceInclude,
          },
        },
      }),
      prisma.serviceCategory.count({ where }),
    ]);
    return {
      total,
      categories: rows.map((category) => ({
        ...categoryDto(category, 'public'),
        labels: category.labels.map((label) => labelDto(label, 'public')),
        services: category.services.map((service) => serviceDto(service, 'public')),
      })),
    };
  }

  async getPublicCategory(slug: string) {
    const category = await prisma.serviceCategory.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      include: {
        labels: { where: { isActive: true }, orderBy: activeLabelOrder },
        services: {
          where: { isActive: true, deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: serviceInclude,
        },
      },
    });
    if (!category) throw new NotFoundError('Category');
    return {
      ...categoryDto(category, 'public'),
      labels: category.labels.map((label) => labelDto(label, 'public')),
      services: category.services.map((service) => serviceDto(service, 'public')),
    };
  }

  async listPublicCategoryServices(slug: string, query: PublicCategoryServicesQuery) {
    const category = await prisma.serviceCategory.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      select: { slug: true },
    });
    if (!category) throw new NotFoundError('Category');
    return this.listPublicServices({
      page: query.page,
      limit: query.limit,
      search: query.search,
      category: category.slug,
      label: query.label,
      sortBy: query.sortBy,
      order: query.order,
    });
  }

  async listPublicServices(query: PublicServiceQuery) {
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      deletedAt: null,
      category: { isActive: true, deletedAt: null },
    };
    if (query.category) where.category = { slug: query.category, isActive: true, deletedAt: null };
    if (query.label) {
      if (!query.category) throw new ValidationError('Choose a category before filtering by label', { label: ['Choose a category before filtering by label'] });
      const label = await prisma.categoryLabel.findFirst({
        where: {
          slug: query.label,
          isActive: true,
          category: { slug: query.category, isActive: true, deletedAt: null },
        },
        select: { id: true },
      });
      if (!label) throw new NotFoundError('Label');
      where.labels = { some: { labelId: label.id } };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const orderField = query.sortBy === 'name' ? 'name' : 'sortOrder';
    const [rows, total] = await prisma.$transaction([
      prisma.service.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [orderField]: query.order }, { name: 'asc' }],
        include: serviceInclude,
      }),
      prisma.service.count({ where }),
    ]);
    return { total, services: rows.map((service) => serviceDto(service, 'public')) };
  }

  async getPublicService(slug: string) {
    const service = await prisma.service.findFirst({
      where: {
        slug,
        isActive: true,
        deletedAt: null,
        category: { isActive: true, deletedAt: null },
      },
      include: serviceInclude,
    });
    if (!service) throw new NotFoundError('Service');
    return serviceDto(service, 'public');
  }

  async listAdminCategories(query: AdminCategoryQuery) {
    const where: Prisma.ServiceCategoryWhereInput = { deletedAt: null };
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const orderField = categoryOrderFields[query.sortBy];
    const [rows, total] = await prisma.$transaction([
      prisma.serviceCategory.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [orderField]: query.order }, { name: 'asc' }],
        include: { _count: { select: { services: { where: { deletedAt: null } } } } },
      }),
      prisma.serviceCategory.count({ where }),
    ]);
    return {
      total,
      categories: rows.map((category) => ({
        ...categoryDto(category, 'admin'),
        serviceCount: category._count.services,
      })),
    };
  }

  async getAdminCategory(id: string) {
    const category = await prisma.serviceCategory.findFirst({ where: { id, deletedAt: null } });
    if (!category) throw new NotFoundError('Category');
    return categoryDto(category, 'admin');
  }

  async createCategory(input: CreateCategoryInput, userId: string, ipAddress?: string) {
    const slug = input.slug || slugFromName(input.name);
    if (!slug) throw new BusinessError('Enter a name that can be used in a URL');
    const image = await resolveImage(input.imageKey, 'category');
    try {
      const category = await prisma.serviceCategory.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          note: input.note,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          seoKeywords: input.seoKeywords,
          isActive: input.isActive,
          isFeatured: input.isFeatured,
          sortOrder: input.sortOrder,
          imageKey: image?.imageKey ?? null,
          imageUrl: null,
        },
      });
      await auditService.log('ServiceCategory', category.id, 'CREATE', null, { name: category.name, slug }, userId, userId, ipAddress);
      return categoryDto(category, 'admin');
    } catch (error) {
      if (image?.imageKey) await releaseImage(image.imageKey, 'category');
      rethrowWrite(error);
    }
  }

  async updateCategory(id: string, input: UpdateCategoryInput, userId: string, ipAddress?: string) {
    const existing = await prisma.serviceCategory.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundError('Category');
    const image = await resolveImage(input.imageKey, 'category');
    try {
      const category = await prisma.serviceCategory.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
          ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
          ...(input.seoKeywords !== undefined ? { seoKeywords: input.seoKeywords } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(image ? { imageKey: image.imageKey, imageUrl: null } : {}),
        },
      });
      if (image && existing.imageKey && !sameImage(existing.imageKey, image.imageKey)) {
        await releaseImage(existing.imageKey, 'category', { categoryId: id });
      }
      await auditService.log(
        'ServiceCategory',
        id,
        'UPDATE',
        { name: existing.name, slug: existing.slug, isActive: existing.isActive, isFeatured: existing.isFeatured, sortOrder: existing.sortOrder },
        { name: category.name, slug: category.slug, isActive: category.isActive, isFeatured: category.isFeatured, sortOrder: category.sortOrder },
        userId,
        userId,
        ipAddress
      );
      return categoryDto(category, 'admin');
    } catch (error) {
      if (image?.imageKey && !sameImage(image.imageKey, existing.imageKey)) await releaseImage(image.imageKey, 'category');
      rethrowWrite(error);
    }
  }

  async deleteCategory(id: string, userId: string, ipAddress?: string) {
    const existing = await prisma.serviceCategory.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { services: true } } },
    });
    if (!existing) throw new NotFoundError('Category');
    if (existing._count.services > 0) {
      throw new ConflictError('This category still has services, including removed ones. Deactivate the category instead of deleting it.');
    }
    await prisma.serviceCategory.delete({ where: { id } });
    await releaseImage(existing.imageKey, 'category', { categoryId: id });
    await auditService.log('ServiceCategory', id, 'DELETE', { name: existing.name, slug: existing.slug }, null, userId, userId, ipAddress);
    return { id, deleted: true };
  }

  async listAdminServices(query: AdminServiceQuery) {
    const where: Prisma.ServiceWhereInput = { deletedAt: null };
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const orderField = serviceOrderFields[query.sortBy];
    const [rows, total] = await prisma.$transaction([
      prisma.service.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [orderField]: query.order }, { name: 'asc' }],
        include: serviceInclude,
      }),
      prisma.service.count({ where }),
    ]);
    return { total, services: rows.map((service) => serviceDto(service, 'admin')) };
  }

  async getAdminService(id: string) {
    const service = await prisma.service.findFirst({
      where: { id, deletedAt: null },
      include: serviceInclude,
    });
    if (!service) throw new NotFoundError('Service');
    return serviceDto(service, 'admin');
  }

  async createService(input: CreateServiceInput, userId: string, ipAddress?: string) {
    const category = await prisma.serviceCategory.findFirst({
      where: { id: input.categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new NotFoundError('Category');
    const slug = input.slug || slugFromName(input.name);
    if (!slug) throw new BusinessError('Enter a name that can be used in a URL');
    const image = await resolveImage(input.imageKey, 'service');
    try {
      const service = await prisma.$transaction(async (tx) => {
        const labelIds = await resolveLabelAssignment(tx, input.categoryId, input.labelIds ?? []);
        const created = await tx.service.create({
          data: {
            categoryId: input.categoryId,
            name: input.name,
            slug,
            shortDescription: input.shortDescription,
            description: input.description,
            mrp: input.mrp,
            sellingPrice: input.sellingPrice,
            isActive: input.isActive,
            sortOrder: input.sortOrder,
            imageKey: image?.imageKey ?? null,
            imageUrl: null,
          },
        });
        await replaceServiceLabels(tx, created.id, labelIds ?? []);
        return tx.service.findFirstOrThrow({ where: { id: created.id }, include: serviceInclude });
      });
      await auditService.log('Service', service.id, 'CREATE', null, { name: service.name, slug, mrp: input.mrp, sellingPrice: input.sellingPrice, labelIds: input.labelIds ?? [] }, userId, userId, ipAddress);
      return serviceDto(service, 'admin');
    } catch (error) {
      if (image?.imageKey) await releaseImage(image.imageKey, 'service');
      rethrowWrite(error);
    }
  }

  /**
   * Label assignment on update:
   * - `labelIds` present: replace the set. Every id must exist, be active, and belong to the category being saved.
   * - `labelIds` omitted and category unchanged: keep current assignments.
   * - `labelIds` omitted and category changed: drop labels that do not belong to the new category and keep the rest.
   */
  async updateService(id: string, input: UpdateServiceInput, userId: string, ipAddress?: string) {
    const existing = await prisma.service.findFirst({
      where: { id, deletedAt: null },
      include: serviceInclude,
    });
    if (!existing) throw new NotFoundError('Service');
    const nextCategoryId = input.categoryId ?? existing.categoryId;
    if (input.categoryId) {
      const category = await prisma.serviceCategory.findFirst({
        where: { id: input.categoryId, deletedAt: null },
        select: { id: true },
      });
      if (!category) throw new NotFoundError('Category');
    }
    const nextMrp = input.mrp ?? decimalToAmount(existing.mrp);
    const nextSelling = input.sellingPrice ?? decimalToAmount(existing.sellingPrice);
    const mrpMoney = parseMoney(nextMrp);
    const sellingMoney = parseMoney(nextSelling);
    if (!mrpMoney || !sellingMoney || sellingMoney.paise > mrpMoney.paise) {
      throw new BusinessError('Selling price cannot be greater than MRP');
    }
    const image = await resolveImage(input.imageKey, 'service');
    try {
      const service = await prisma.$transaction(async (tx) => {
        const labelIds = await resolveLabelAssignment(tx, nextCategoryId, input.labelIds);
        await tx.service.update({
          where: { id },
          data: {
            ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(input.shortDescription !== undefined ? { shortDescription: input.shortDescription } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.mrp !== undefined ? { mrp: input.mrp } : {}),
            ...(input.sellingPrice !== undefined ? { sellingPrice: input.sellingPrice } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            ...(image ? { imageKey: image.imageKey, imageUrl: null } : {}),
          },
        });
        if (labelIds) {
          await replaceServiceLabels(tx, id, labelIds);
        } else if (input.categoryId && input.categoryId !== existing.categoryId) {
          await tx.serviceLabel.deleteMany({
            where: { serviceId: id, label: { categoryId: { not: nextCategoryId } } },
          });
        }
        return tx.service.findFirstOrThrow({ where: { id }, include: serviceInclude });
      });
      if (image && existing.imageKey && !sameImage(existing.imageKey, image.imageKey)) {
        await releaseImage(existing.imageKey, 'service', { serviceId: id });
      }
      await auditService.log(
        'Service',
        id,
        'UPDATE',
        { name: existing.name, slug: existing.slug, isActive: existing.isActive, mrp: decimalToAmount(existing.mrp), sellingPrice: decimalToAmount(existing.sellingPrice) },
        { name: service.name, slug: service.slug, isActive: service.isActive, mrp: nextMrp, sellingPrice: nextSelling, labelIds: input.labelIds },
        userId,
        userId,
        ipAddress
      );
      return serviceDto(service, 'admin');
    } catch (error) {
      if (image?.imageKey && !sameImage(image.imageKey, existing.imageKey)) await releaseImage(image.imageKey, 'service');
      rethrowWrite(error);
    }
  }

  async deleteService(id: string, userId: string, ipAddress?: string) {
    const existing = await prisma.service.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundError('Service');
    await prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await auditService.log('Service', id, 'DELETE', { name: existing.name, slug: existing.slug }, { deleted: true }, userId, userId, ipAddress);
    return { id, deleted: true };
  }

  async listLabels(categoryId: string, query: AdminLabelQuery) {
    await this.requireCategory(categoryId);
    const where: Prisma.CategoryLabelWhereInput = { categoryId };
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;
    const labels = await prisma.categoryLabel.findMany({
      where,
      orderBy: activeLabelOrder,
    });
    return labels.map((label) => labelDto(label, 'admin'));
  }

  async createLabel(categoryId: string, input: CreateLabelInput, userId: string, ipAddress?: string) {
    await this.requireCategory(categoryId);
    const slug = input.slug || slugFromName(input.name);
    if (!slug) throw new BusinessError('Enter a name that can be used in a URL');
    await this.ensureLabelIdentity(categoryId, input.name, slug);
    try {
      const label = await prisma.categoryLabel.create({
        data: {
          categoryId,
          name: input.name,
          slug,
          description: input.description,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
      });
      await auditService.log('CategoryLabel', label.id, 'CREATE', null, { categoryId, name: label.name, slug }, userId, userId, ipAddress);
      return labelDto(label, 'admin');
    } catch (error) {
      rethrowLabelWrite(error);
    }
  }

  async updateLabel(categoryId: string, labelId: string, input: UpdateLabelInput, userId: string, ipAddress?: string) {
    const existing = await this.requireLabel(categoryId, labelId);
    const name = input.name ?? existing.name;
    const slug = input.slug ?? existing.slug;
    await this.ensureLabelIdentity(categoryId, name, slug, labelId);
    try {
      const label = await prisma.categoryLabel.update({
        where: { id: labelId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await auditService.log(
        'CategoryLabel',
        labelId,
        'UPDATE',
        { name: existing.name, slug: existing.slug, isActive: existing.isActive, sortOrder: existing.sortOrder },
        { name: label.name, slug: label.slug, isActive: label.isActive, sortOrder: label.sortOrder },
        userId,
        userId,
        ipAddress
      );
      return labelDto(label, 'admin');
    } catch (error) {
      rethrowLabelWrite(error);
    }
  }

  async deleteLabel(categoryId: string, labelId: string, userId: string, ipAddress?: string) {
    const existing = await this.requireLabel(categoryId, labelId);
    const used = await prisma.serviceLabel.count({ where: { labelId } });
    if (used > 0) {
      throw new ConflictError('This label is assigned to services. Deactivate it instead of deleting it.');
    }
    await prisma.categoryLabel.delete({ where: { id: labelId } });
    await auditService.log('CategoryLabel', labelId, 'DELETE', { name: existing.name, slug: existing.slug }, null, userId, userId, ipAddress);
    return { id: labelId, deleted: true };
  }

  private async requireCategory(categoryId: string) {
    const category = await prisma.serviceCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new NotFoundError('Category');
    return category;
  }

  private async requireLabel(categoryId: string, labelId: string) {
    await this.requireCategory(categoryId);
    const label = await prisma.categoryLabel.findFirst({ where: { id: labelId, categoryId } });
    if (!label) throw new NotFoundError('Label');
    return label;
  }

  private async ensureLabelIdentity(categoryId: string, name: string, slug: string, exceptId?: string) {
    const rows = await prisma.categoryLabel.findMany({
      where: { categoryId, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { name: true, slug: true },
    });
    if (rows.some((row) => row.slug === slug)) {
      throw new ConflictError('That label slug is already used in this category');
    }
    if (rows.some((row) => row.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new ConflictError('That label name is already used in this category');
    }
  }
}

function rethrowLabelWrite(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictError('That label name or slug is already used in this category');
  }
  throw error;
}

export const catalogueService = new CatalogueService();
