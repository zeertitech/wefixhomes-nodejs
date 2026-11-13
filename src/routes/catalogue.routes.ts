import { FastifyInstance } from 'fastify';
import { catalogueController } from '../controllers/catalogue.controller';
import { env } from '../config/env';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

const staff = [authenticate, authorize('ADMIN', 'STAFF')];

const uploadLimit = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: 60_000,
    },
  },
};

export async function publicCategoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Service catalogue'], summary: 'List active service categories' },
    handler: catalogueController.listPublicCategories.bind(catalogueController),
  });

  app.get('/:slug/services', {
    schema: { tags: ['Service catalogue'], summary: 'List active services in a category' },
    handler: catalogueController.listPublicCategoryServices.bind(catalogueController),
  });

  app.get('/:slug', {
    schema: { tags: ['Service catalogue'], summary: 'Get an active service category' },
    handler: catalogueController.getPublicCategory.bind(catalogueController),
  });
}

export async function publicServiceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Service catalogue'], summary: 'List active services' },
    handler: catalogueController.listPublicServices.bind(catalogueController),
  });

  app.get('/:slug', {
    schema: { tags: ['Service catalogue'], summary: 'Get an active service' },
    handler: catalogueController.getPublicService.bind(catalogueController),
  });
}

export async function adminCategoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Service catalogue'], summary: 'List service categories', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.listAdminCategories.bind(catalogueController),
  });

  app.post('/', {
    schema: { tags: ['Service catalogue'], summary: 'Create a service category', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.createCategory.bind(catalogueController),
  });

  app.get('/:id', {
    schema: { tags: ['Service catalogue'], summary: 'Get a service category', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.getAdminCategory.bind(catalogueController),
  });

  app.patch('/:id', {
    schema: { tags: ['Service catalogue'], summary: 'Update a service category', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.updateCategory.bind(catalogueController),
  });

  app.delete('/:id', {
    schema: { tags: ['Service catalogue'], summary: 'Delete an unused service category', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.deleteCategory.bind(catalogueController),
  });

  app.get('/:categoryId/labels', {
    schema: { tags: ['Service catalogue'], summary: 'List labels for a service category', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.listLabels.bind(catalogueController),
  });

  app.post('/:categoryId/labels', {
    schema: { tags: ['Service catalogue'], summary: 'Create a category label', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.createLabel.bind(catalogueController),
  });

  app.patch('/:categoryId/labels/:labelId', {
    schema: { tags: ['Service catalogue'], summary: 'Update a category label', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.updateLabel.bind(catalogueController),
  });

  app.delete('/:categoryId/labels/:labelId', {
    schema: { tags: ['Service catalogue'], summary: 'Delete an unused category label', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.deleteLabel.bind(catalogueController),
  });
}

export async function adminServiceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Service catalogue'], summary: 'List services', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.listAdminServices.bind(catalogueController),
  });

  app.post('/', {
    schema: { tags: ['Service catalogue'], summary: 'Create a service', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.createService.bind(catalogueController),
  });

  app.get('/:id', {
    schema: { tags: ['Service catalogue'], summary: 'Get a service', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.getAdminService.bind(catalogueController),
  });

  app.patch('/:id', {
    schema: { tags: ['Service catalogue'], summary: 'Update a service', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.updateService.bind(catalogueController),
  });

  app.delete('/:id', {
    schema: { tags: ['Service catalogue'], summary: 'Delete a service that no enquiry names', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.deleteService.bind(catalogueController),
  });
}

export async function adminUploadRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', {
    ...uploadLimit,
    bodyLimit: parseInt(env.MAX_FILE_SIZE, 10) + 65_536,
    schema: { tags: ['Service catalogue'], summary: 'Upload a catalogue image', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.uploadImage.bind(catalogueController),
  });

  app.post('/presign', {
    ...uploadLimit,
    schema: { tags: ['Service catalogue'], summary: 'Create a short-lived image upload URL', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.presignUpload.bind(catalogueController),
  });

  app.post('/confirm', {
    ...uploadLimit,
    schema: { tags: ['Service catalogue'], summary: 'Verify an uploaded catalogue image', security: [{ bearerAuth: [] }] },
    preHandler: staff,
    handler: catalogueController.confirmUpload.bind(catalogueController),
  });
}
