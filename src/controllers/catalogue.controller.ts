import { FastifyReply, FastifyRequest } from 'fastify';
import { catalogueService } from '../services/catalogue.service';
import { paginationMeta, sendCreated, sendSuccess } from '../lib/response';
import {
  adminCategoryQuerySchema,
  adminLabelQuerySchema,
  adminServiceQuerySchema,
  categoryIdParamSchema,
  categoryLabelParamSchema,
  confirmUploadSchema,
  createCategorySchema,
  createLabelSchema,
  createServiceSchema,
  idParamSchema,
  presignUploadSchema,
  publicCategoryQuerySchema,
  publicCategoryServicesQuerySchema,
  publicServiceQuerySchema,
  slugParamSchema,
  updateCategorySchema,
  updateLabelSchema,
  updateServiceSchema,
  uploadPurposeSchema,
} from '../validators/catalogue.validator';
import { storageService } from '../services/storage.service';
import { BusinessError } from '../lib/errors';
import { catalogueFileName, parseObjectKey } from '../utils/object-key';
import { env } from '../config/env';

export class CatalogueController {
  async listPublicCategories(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = publicCategoryQuerySchema.parse(request.query);
    const { categories, total } = await catalogueService.listPublicCategories(query);
    sendSuccess(reply, categories, 'Categories fetched', 200, paginationMeta(query.page, query.limit, total));
  }

  async getPublicCategory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { slug } = slugParamSchema.parse(request.params);
    sendSuccess(reply, await catalogueService.getPublicCategory(slug), 'Category fetched');
  }

  async listPublicCategoryServices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { slug } = slugParamSchema.parse(request.params);
    const query = publicCategoryServicesQuerySchema.parse(request.query);
    const { services, total } = await catalogueService.listPublicCategoryServices(slug, query);
    sendSuccess(reply, services, 'Services fetched', 200, paginationMeta(query.page, query.limit, total));
  }

  async listPublicServices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = publicServiceQuerySchema.parse(request.query);
    const { services, total } = await catalogueService.listPublicServices(query);
    sendSuccess(reply, services, 'Services fetched', 200, paginationMeta(query.page, query.limit, total));
  }

  async getPublicService(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { slug } = slugParamSchema.parse(request.params);
    sendSuccess(reply, await catalogueService.getPublicService(slug), 'Service fetched');
  }

  async listAdminCategories(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = adminCategoryQuerySchema.parse(request.query);
    const { categories, total } = await catalogueService.listAdminCategories(query);
    sendSuccess(reply, categories, 'Categories fetched', 200, paginationMeta(query.page, query.limit, total));
  }

  async getAdminCategory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    sendSuccess(reply, await catalogueService.getAdminCategory(id), 'Category fetched');
  }

  async createCategory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createCategorySchema.parse(request.body);
    const category = await catalogueService.createCategory(input, request.user!.userId, request.ip);
    sendCreated(reply, category, 'Category created');
  }

  async updateCategory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    const input = updateCategorySchema.parse(request.body);
    const category = await catalogueService.updateCategory(id, input, request.user!.userId, request.ip);
    sendSuccess(reply, category, 'Category updated');
  }

  async deleteCategory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    const result = await catalogueService.deleteCategory(id, request.user!.userId, request.ip);
    sendSuccess(reply, result, 'Category deleted');
  }

  async listLabels(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { categoryId } = categoryIdParamSchema.parse(request.params);
    const query = adminLabelQuerySchema.parse(request.query);
    sendSuccess(reply, await catalogueService.listLabels(categoryId, query), 'Labels fetched');
  }

  async createLabel(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { categoryId } = categoryIdParamSchema.parse(request.params);
    const input = createLabelSchema.parse(request.body);
    const label = await catalogueService.createLabel(categoryId, input, request.user!.userId, request.ip);
    sendCreated(reply, label, 'Label created');
  }

  async updateLabel(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { categoryId, labelId } = categoryLabelParamSchema.parse(request.params);
    const input = updateLabelSchema.parse(request.body);
    const label = await catalogueService.updateLabel(categoryId, labelId, input, request.user!.userId, request.ip);
    sendSuccess(reply, label, 'Label updated');
  }

  async deleteLabel(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { categoryId, labelId } = categoryLabelParamSchema.parse(request.params);
    const result = await catalogueService.deleteLabel(categoryId, labelId, request.user!.userId, request.ip);
    sendSuccess(reply, result, 'Label deleted');
  }

  async listAdminServices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = adminServiceQuerySchema.parse(request.query);
    const { services, total } = await catalogueService.listAdminServices(query);
    sendSuccess(reply, services, 'Services fetched', 200, paginationMeta(query.page, query.limit, total));
  }

  async getAdminService(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    sendSuccess(reply, await catalogueService.getAdminService(id), 'Service fetched');
  }

  async createService(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createServiceSchema.parse(request.body);
    const service = await catalogueService.createService(input, request.user!.userId, request.ip);
    sendCreated(reply, service, 'Service created');
  }

  async updateService(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    const input = updateServiceSchema.parse(request.body);
    const service = await catalogueService.updateService(id, input, request.user!.userId, request.ip);
    sendSuccess(reply, service, 'Service updated');
  }

  async deleteService(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    const result = await catalogueService.deleteService(id, request.user!.userId, request.ip);
    sendSuccess(reply, result, 'Service deleted');
  }

  async uploadImage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.isMultipart()) throw new BusinessError('Upload an image file');
    const file = await request.file({
      limits: { fileSize: parseInt(env.MAX_FILE_SIZE, 10), files: 1 },
    });
    if (!file) throw new BusinessError('Choose an image to upload');

    const buffer = await file.toBuffer();
    if (file.file.truncated) throw new BusinessError('Image is too large');
    const purposeField = file.fields.purpose;
    const slugFieldValue = file.fields.slug;
    const purposeValue = purposeField && !Array.isArray(purposeField) && purposeField.type === 'field'
      ? purposeField.value
      : undefined;
    const slugValue = slugFieldValue && !Array.isArray(slugFieldValue) && slugFieldValue.type === 'field'
      ? slugFieldValue.value
      : undefined;
    const { purpose, slug } = uploadPurposeSchema.parse({ purpose: purposeValue, slug: slugValue });

    const image = await storageService.uploadCatalogueImage(buffer, purpose, slug);
    sendSuccess(reply, image, 'Image uploaded');
  }

  async presignUpload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = presignUploadSchema.parse(request.body);
    const upload = await storageService.createPresignedUpload(input.purpose, input.contentType, input.contentLength);
    sendSuccess(reply, upload, 'Upload link created');
  }

  async confirmUpload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = confirmUploadSchema.parse(request.body);
    const parsed = parseObjectKey(input.imageKey, storageService.folders());
    const fileName = parsed ? catalogueFileName(parsed.key) : null;
    if (!parsed || !fileName) throw new BusinessError('Image is not in an allowed folder');
    const image = await storageService.verifyUploadedImage(fileName, parsed.purpose);
    sendSuccess(reply, image, 'Image verified');
  }
}

export const catalogueController = new CatalogueController();
