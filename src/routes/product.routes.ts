import { FastifyInstance } from 'fastify';
import { productController } from '../controllers/product.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

export async function productRoutes(app: FastifyInstance): Promise<void> {
  // ── Public routes ─────────────────────────────────────────
  app.get('/', {
    schema: { tags: ['Products'], summary: 'List products with filters & pagination' },
    handler: productController.list.bind(productController),
  });

  app.get<{ Params: { slug: string } }>('/:slug', {
    schema: { tags: ['Products'], summary: 'Get product by slug' },
    handler: productController.getBySlug.bind(productController),
  });

  // ── Admin / Staff routes ──────────────────────────────────
  app.post('/', {
    schema: {
      tags: ['Products'],
      summary: 'Create product with variants',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN')],
    handler: productController.create.bind(productController),
  });

  app.patch<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Products'],
      summary: 'Update product base fields',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: productController.update.bind(productController),
  });

  app.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Products'],
      summary: 'Soft-delete a product',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN')],
    handler: productController.delete.bind(productController),
  });

  app.post<{ Params: { id: string } }>('/:id/images', {
    schema: {
      tags: ['Products'],
      summary: 'Upload product images (multipart)',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: productController.uploadImages.bind(productController),
  });

  app.delete<{ Params: { id: string; imageId: string } }>('/:id/images/:imageId', {
    schema: {
      tags: ['Products'],
      summary: 'Delete a product image',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: productController.deleteImage.bind(productController),
  });
}
