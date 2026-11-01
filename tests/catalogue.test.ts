import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { offerPercent, parseMoney } from '../src/utils/money';
import { catalogueFileName, parseObjectKey } from '../src/utils/object-key';
import { matchesImageSignature } from '../src/utils/image-signature';
import { buildDeliveryUrl, buildFolderFileUrl } from '../src/utils/delivery-url';
import { createServiceSchema, presignUploadSchema } from '../src/validators/catalogue.validator';
import { catalogueService } from '../src/services/catalogue.service';
import { ConflictError, ValidationError } from '../src/lib/errors';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const suffix = `test-${Date.now()}`;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await prisma.service.deleteMany({ where: { slug: { startsWith: suffix } } });
  await prisma.serviceCategory.deleteMany({ where: { slug: { startsWith: suffix } } });
  await app.close();
});

describe('catalogue money and upload rules', () => {
  it('parses rupee strings as paise and refuses MRP division by zero', () => {
    expect(parseMoney('3999.5')?.paise).toBe(399950);
    expect(parseMoney('0')?.amount).toBe('0.00');
    expect(parseMoney('10.999')).toBeNull();
    expect(offerPercent(0, 0)).toBeNull();
    expect(offerPercent(10000, 8000)).toBe(20);
  });

  it('rejects a selling price above MRP', () => {
    const result = createServiceSchema.safeParse({
      categoryId: 'c'.padEnd(25, 'a'),
      name: 'Test',
      mrp: '100.00',
      sellingPrice: '150.00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects disallowed image types and oversized uploads', () => {
    expect(presignUploadSchema.safeParse({
      purpose: 'category',
      contentType: 'image/gif',
      contentLength: 1000,
    }).success).toBe(false);
    expect(presignUploadSchema.safeParse({
      purpose: 'service',
      contentType: 'image/webp',
      contentLength: 20_000_000,
    }).success).toBe(false);
  });

  it('rejects path traversal and accepts only random keys in known folders', () => {
    const folders = { category: 'categories', service: 'services' };
    expect(parseObjectKey('../services/file.jpg', folders)).toBeNull();
    expect(parseObjectKey('categories/not-a-uuid.jpg', folders)).toBeNull();
    const key = 'services/11111111-1111-1111-1111-111111111111.webp';
    expect(parseObjectKey(key, folders)?.purpose).toBe('service');
    expect(buildDeliveryUrl('https://cdn.example.com', key, folders, false)).toBe(
      'https://cdn.example.com/services/11111111-1111-1111-1111-111111111111.webp'
    );
    expect(buildDeliveryUrl('http://cdn.example.com', key, folders, false)).toBeNull();
    const fileName = 'painting-11111111-1111-4111-8111-111111111111.webp';
    expect(catalogueFileName(`categories/${fileName}`)).toBe(fileName);
    expect(catalogueFileName('../categories/file.webp')).toBeNull();
    expect(buildFolderFileUrl('https://cdn.example.com', 'categories', fileName, false)).toBe(
      `https://cdn.example.com/categories/${fileName}`
    );
  });

  it('checks image signatures', () => {
    expect(matchesImageSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), 'jpg')).toBe(true);
    expect(matchesImageSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), 'png')).toBe(false);
  });
});

describe('catalogue routes', () => {
  it('requires authentication for admin catalogue writes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/service-categories',
      payload: { name: 'Painting' },
    });
    expect(res.statusCode).toBe(401);
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/uploads/presign',
      payload: { purpose: 'service', contentType: 'image/png', contentLength: 10 },
    });
    expect(upload.statusCode).toBe(401);
    const direct = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/uploads',
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
      payload: '--test\r\nContent-Disposition: form-data; name="purpose"\r\n\r\ncategory\r\n--test--\r\n',
    });
    expect(direct.statusCode).toBe(401);
  });

  it('hides inactive services from the public catalogue', async () => {
    const category = await prisma.serviceCategory.create({
      data: { name: 'Hidden test', slug: `${suffix}-category`, sortOrder: 5, isActive: true },
    });
    const hidden = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: 'Hidden service',
        slug: `${suffix}-hidden`,
        mrp: '100.00',
        sellingPrice: '80.00',
        isActive: false,
        sortOrder: 1,
      },
    });
    const visible = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: 'Visible service',
        slug: `${suffix}-visible`,
        mrp: '100.00',
        sellingPrice: '90.00',
        isActive: true,
        sortOrder: 0,
      },
    });

    const hiddenRes = await app.inject({ method: 'GET', url: `/api/v1/services/${hidden.slug}` });
    expect(hiddenRes.statusCode).toBe(404);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/service-categories/${category.slug}`,
    });
    expect(list.statusCode).toBe(200);
    const body = list.json<{ data: { services: Array<{ slug: string; offerPercent: number }> } }>();
    expect(body.data.services.map((service) => service.slug)).toEqual([visible.slug]);
    expect(body.data.services[0]?.offerPercent).toBe(10);
    await expect(catalogueService.deleteCategory(category.id, 'catalogue-test')).rejects.toBeInstanceOf(ConflictError);

    await prisma.serviceCategory.update({ where: { id: category.id }, data: { isActive: false } });
    const inactiveCategory = await app.inject({
      method: 'GET',
      url: `/api/v1/services/${visible.slug}`,
    });
    expect(inactiveCategory.statusCode).toBe(404);
  });

  it('rejects deletion of a category that still has services', async () => {
    const category = await prisma.serviceCategory.findFirst({ where: { slug: `${suffix}-category` } });
    expect(category).toBeTruthy();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/service-categories/${category?.id}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('requires authentication for label changes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/service-categories/cjld2cjxh0000qzrmn831i7rn/labels',
      payload: { name: 'Interior', slug: 'interior' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('category labels', () => {
  it('assigns labels only inside the service category and filters the public list', async () => {
    const painting = await prisma.serviceCategory.create({
      data: { name: 'Label painting', slug: `${suffix}-painting`, isActive: true, sortOrder: 1 },
    });
    const plumbing = await prisma.serviceCategory.create({
      data: { name: 'Label plumbing', slug: `${suffix}-plumbing`, isActive: true, sortOrder: 2 },
    });
    const interior = await catalogueService.createLabel(painting.id, { name: 'Interior', slug: `${suffix}-interior`, description: null, isActive: true, sortOrder: 0 }, 'catalogue-test');
    const exterior = await catalogueService.createLabel(painting.id, { name: 'Exterior', slug: `${suffix}-exterior`, description: null, isActive: true, sortOrder: 1 }, 'catalogue-test');
    const repair = await catalogueService.createLabel(plumbing.id, { name: 'Repair', slug: `${suffix}-repair`, description: null, isActive: true, sortOrder: 0 }, 'catalogue-test');
    await catalogueService.updateLabel(painting.id, exterior.id, { isActive: false }, 'catalogue-test');

    const service = await catalogueService.createService({
      categoryId: painting.id,
      name: 'Room painting',
      slug: `${suffix}-room`,
      shortDescription: null,
      description: null,
      mrp: '100.00',
      sellingPrice: '80.00',
      isActive: true,
      sortOrder: 0,
      labelIds: [interior.id],
    }, 'catalogue-test');
    expect(service.labels.map((label) => label.slug)).toEqual([`${suffix}-interior`]);

    await expect(catalogueService.updateService(service.id, { labelIds: [interior.id, repair.id] }, 'catalogue-test')).rejects.toBeInstanceOf(ValidationError);
    await expect(catalogueService.createService({
      categoryId: painting.id,
      name: 'Bad labels',
      slug: `${suffix}-bad`,
      shortDescription: null,
      description: null,
      mrp: '100.00',
      sellingPrice: '90.00',
      isActive: true,
      sortOrder: 2,
      labelIds: [interior.id, interior.id],
    }, 'catalogue-test')).rejects.toBeInstanceOf(ValidationError);

    const moved = await catalogueService.createService({
      categoryId: painting.id,
      name: 'Move me',
      slug: `${suffix}-move`,
      shortDescription: null,
      description: null,
      mrp: '50.00',
      sellingPrice: '40.00',
      isActive: true,
      sortOrder: 3,
      labelIds: [interior.id],
    }, 'catalogue-test');
    const afterMove = await catalogueService.updateService(moved.id, { categoryId: plumbing.id }, 'catalogue-test');
    expect(afterMove.labels).toEqual([]);

    const filtered = await app.inject({
      method: 'GET',
      url: `/api/v1/service-categories/${painting.slug}/services?label=${suffix}-interior`,
    });
    expect(filtered.statusCode).toBe(200);
    const filteredBody = filtered.json<{ data: Array<{ slug: string }> }>();
    expect(filteredBody.data.map((row) => row.slug)).toEqual([`${suffix}-room`]);

    const unknown = await app.inject({
      method: 'GET',
      url: `/api/v1/service-categories/${painting.slug}/services?label=${suffix}-missing`,
    });
    expect(unknown.statusCode).toBe(404);

    const inactive = await app.inject({
      method: 'GET',
      url: `/api/v1/service-categories/${painting.slug}/services?label=${suffix}-exterior`,
    });
    expect(inactive.statusCode).toBe(404);

    const categoryRes = await app.inject({ method: 'GET', url: `/api/v1/service-categories/${painting.slug}` });
    const categoryBody = categoryRes.json<{ data: { labels: Array<{ slug: string }> } }>();
    expect(categoryBody.data.labels.map((label) => label.slug)).toEqual([`${suffix}-interior`]);

    await expect(catalogueService.deleteLabel(painting.id, interior.id, 'catalogue-test')).rejects.toBeInstanceOf(ConflictError);
    await catalogueService.deleteLabel(painting.id, exterior.id, 'catalogue-test');
  });
});
