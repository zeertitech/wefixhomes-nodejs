import { FastifyInstance } from 'fastify';
import { categoryController } from '../controllers/category.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Categories'], summary: 'List all active categories (with children)' },
    handler: categoryController.list.bind(categoryController),
  });

  app.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Categories'], summary: 'Get category by ID' },
    handler: categoryController.getById.bind(categoryController),
  });

  app.post('/', {
    schema: {
      tags: ['Categories'],
      summary: 'Create category',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN')],
    handler: categoryController.create.bind(categoryController),
  });

  app.patch<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Categories'],
      summary: 'Update category',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN')],
    handler: categoryController.update.bind(categoryController),
  });

  app.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Categories'],
      summary: 'Deactivate category',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN')],
    handler: categoryController.delete.bind(categoryController),
  });
}
