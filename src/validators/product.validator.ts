import { z } from 'zod';
import { paginationSchema } from '../utils/pagination';

export const productSizeInputSchema = z.object({
  sizeId: z.string().min(1, 'Size ID is required'),
  sku: z.string().min(1).max(100).optional(),
  price: z.coerce.number().min(0, 'Selling price must be non-negative'),
  comparePrice: z.coerce.number().min(0, 'MRP must be non-negative').optional().nullable(),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative').default(0),
});

export const createProductSchema = z.object({
  groupId: z.string().optional().nullable(),
  groupName: z.string().min(1).max(255).optional().nullable(),
  name: z.string().min(1, 'Product title is required').max(255),
  shortDescription: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  categoryId: z.string().min(1, 'Category is required'),
  colorId: z.string().min(1, 'Colour is required'),
  basePrice: z.coerce.number().min(0, 'Selling price must be non-negative'),
  comparePrice: z.coerce.number().min(0, 'MRP must be non-negative').optional().nullable(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isPrimary: z.boolean().optional(),
  metaTitle: z.string().max(100).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
  keywords: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined || val === null) return [];
      if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }),
  sizes: z.array(productSizeInputSchema).min(1, 'At least one size is required'),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  shortDescription: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional(),
  colorId: z.string().optional(),
  basePrice: z.coerce.number().min(0).optional(),
  comparePrice: z.coerce.number().min(0).optional().nullable(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  metaTitle: z.string().max(100).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
  keywords: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }),
  sizes: z.array(productSizeInputSchema).optional(),
});

export const cloneColourSchema = z.object({
  colorId: z.string().min(1, 'New Colour ID is required'),
  name: z.string().min(1).optional(),
  basePrice: z.coerce.number().min(0).optional(),
  comparePrice: z.coerce.number().min(0).optional().nullable(),
  sizes: z.array(productSizeInputSchema).optional(),
});

export const reorderImagesSchema = z.object({
  images: z
    .array(
      z.object({
        id: z.string(),
        sortOrder: z.number().int().min(0),
        isPrimary: z.boolean().optional(),
      })
    )
    .min(1, 'At least one image order is required'),
});

export const productFilterSchema = paginationSchema.extend({
  categoryId: z.string().optional(),
  categorySlug: z.string().optional(),
  groupId: z.string().optional(),
  colorId: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  isPrimary: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
});

export const publicProductFilterSchema = paginationSchema.extend({
  category: z.string().optional(),
  categorySlug: z.string().optional(),
  categoryId: z.string().optional(),
  subCategory: z.string().optional(),
  subCategorySlug: z.string().optional(),
  groupId: z.string().optional(),
  colorId: z.string().optional(),
  colors: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }),
  color: z.string().optional(),
  sizes: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }),
  size: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  isFeatured: z.coerce.boolean().optional(),
  isPrimary: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  includeFacets: z.coerce.boolean().optional(),
});

export const publicProductFacetFilterSchema = z.object({
  category: z.string().optional(),
  categorySlug: z.string().optional(),
});

export type ProductSizeInput = z.infer<typeof productSizeInputSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CloneColourInput = z.infer<typeof cloneColourSchema>;
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;
export type ProductFilterInput = z.infer<typeof productFilterSchema>;
export type PublicProductFilterInput = z.infer<typeof publicProductFilterSchema>;
export type PublicProductFacetFilterInput = z.infer<typeof publicProductFacetFilterSchema>;

