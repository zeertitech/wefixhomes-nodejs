import { FastifyInstance } from 'fastify';
import { categoryController } from '../controllers/category.controller';

export async function publicCategoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: {
      tags: ['Public Categories'],
      summary: 'List active public categories (supports ?nested=true for hierarchy tree)',
      querystring: {
        type: 'object',
        properties: {
          nested: { type: 'string', description: 'Pass "true" to return tree hierarchy' },
          tree: { type: 'string', description: 'Alias for nested' },
          topLevel: { type: 'string', description: 'Pass "true" to return only root categories (parentId = null)' },
        },
      },
    },
    handler: categoryController.publicList.bind(categoryController),
  });

  app.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Public Categories'],
      summary: 'Get public category by ID or slug',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Category ID or slug' },
        },
        required: ['id'],
      },
    },
    handler: categoryController.publicGetById.bind(categoryController),
  });
}
