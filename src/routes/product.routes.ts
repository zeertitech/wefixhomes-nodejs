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

  app.get('/attributes', {
    schema: { tags: ['Products'], summary: 'Get available color and size attributes' },
    handler: productController.getAttributes.bind(productController),
  });

  app.get<{ Params: { id: string } }>('/id/:id', {
    schema: { tags: ['Products'], summary: 'Get product by ID' },
    handler: productController.getById.bind(productController),
  });

  app.get<{ Params: { slug: string } }>('/:slug', {
    schema: { tags: ['Products'], summary: 'Get product by slug' },
    handler: productController.getBySlug.bind(productController),
  });

  // ── Admin / Staff routes ──────────────────────────────────
  app.post('/', {
    schema: {
      tags: ['Products'],
      summary: 'Create product with colour & sizes',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN')],
    handler: productController.create.bind(productController),
  });

  app.patch<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Products'],
      summary: 'Update product',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: productController.update.bind(productController),
  });

  app.post<{ Params: { id: string } }>('/:id/highlight-primary', {
    schema: {
      tags: ['Products'],
      summary: 'Highlight this product as primary for its Product Group',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: productController.highlightPrimary.bind(productController),
  });

  app.post<{ Params: { id: string } }>('/:id/clone-colour', {
    schema: {
      tags: ['Products'],
      summary: 'Add another colour to product group by cloning product details',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN')],
    handler: productController.cloneColour.bind(productController),
  });

  app.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Products'],
      summary: 'Delete a product (with primary auto-promotion)',
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

  app.patch<{ Params: { id: string } }>('/:id/images/order', {
    schema: {
      tags: ['Products'],
      summary: 'Reorder product images',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: productController.reorderImages.bind(productController),
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
