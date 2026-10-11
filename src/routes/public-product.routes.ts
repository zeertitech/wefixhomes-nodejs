import { FastifyInstance } from 'fastify';
import { publicProductController } from '../controllers/public-product.controller';

export async function publicProductRoutes(app: FastifyInstance): Promise<void> {
  // ── 1. Universal Product List with Filters & Pagination ──
  app.get('/', {
    schema: {
      tags: ['Public Products'],
      summary:
        'Universal public product list with category, featured, price range, size, and color filters',
      querystring: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Category slug or ID (matches category and all subcategories)',
          },
          categorySlug: {
            type: 'string',
            description: 'Alias for category slug',
          },
          subCategory: {
            type: 'string',
            description: 'Specific subcategory slug or ID',
          },
          subCategorySlug: {
            type: 'string',
            description: 'Alias for subcategory slug',
          },
          isFeatured: {
            type: 'boolean',
            description: 'Filter featured products only',
          },
          minPrice: {
            type: 'number',
            description: 'Minimum selling price filter',
          },
          maxPrice: {
            type: 'number',
            description: 'Maximum selling price filter',
          },
          sizes: {
            type: 'string',
            description: 'Comma-separated size values, e.g. S,M,L',
          },
          colors: {
            type: 'string',
            description: 'Comma-separated color values or hex codes, e.g. Maroon,Black',
          },
          isPrimary: {
            type: 'boolean',
            description:
              'Filter primary colorway only (defaults to true for group cards)',
          },
          search: {
            type: 'string',
            description: 'Full text search query',
          },
          sortBy: {
            type: 'string',
            description:
              'Sort option: featured, price-asc, price-desc, newest, name-asc',
          },
          page: {
            type: 'integer',
            default: 1,
            description: 'Page number',
          },
          limit: {
            type: 'integer',
            default: 20,
            description: 'Number of items per page',
          },
          includeFacets: {
            type: 'boolean',
            description: 'Set to true to include category filter facets in response meta',
          },
        },
      },
    },
    handler: publicProductController.list.bind(publicProductController),
  });

  // ── 2. Filter Facets for Category / Storefront ──
  app.get('/filters', {
    schema: {
      tags: ['Public Products'],
      summary: 'Get available filter facets (price range, sizes, colors, subcategories) for a category',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Category slug or ID' },
          categorySlug: { type: 'string', description: 'Category slug' },
        },
      },
    },
    handler: publicProductController.getFilters.bind(publicProductController),
  });

  // ── 3. Public Product by ID ──
  app.get<{ Params: { id: string } }>('/id/:id', {
    schema: {
      tags: ['Public Products'],
      summary: 'Get single public product by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' },
        },
        required: ['id'],
      },
    },
    handler: publicProductController.getById.bind(publicProductController),
  });

  // ── 4. Public Product by Slug ──
  app.get<{ Params: { slug: string } }>('/:slug', {
    schema: {
      tags: ['Public Products'],
      summary: 'Get single public product by slug',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Product slug' },
        },
        required: ['slug'],
      },
    },
    handler: publicProductController.getBySlug.bind(publicProductController),
  });
}
