import { z } from 'zod';
import { paginationSchema } from '../utils/pagination';

const variantSchema = z.object({
  sku: z.string().min(1).max(100),
  price: z.number().positive('Price must be positive'),
  comparePrice: z.number().positive().optional(),
  attributes: z
    .array(
      z.object({
        attributeId: z.string().cuid('Invalid attribute ID'),
        valueId: z.string().cuid('Invalid attribute value ID'),
      })
    )
    .min(1, 'At least one attribute is required'),
  stock: z.number().int().min(0).default(0),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  categoryId: z.string().cuid('Invalid category ID'),
  description: z.string().optional(),
  basePrice: z.number().positive('Base price must be positive'),
  taxRate: z.number().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  keywords: z.array(z.string()).default([]),
  variants: z.array(variantSchema).min(1, 'At least one variant is required'),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  categoryId: z.string().cuid().optional(),
  description: z.string().optional(),
  basePrice: z.number().positive().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  keywords: z.array(z.string()).optional(),
});

export const productFilterSchema = paginationSchema.extend({
  categoryId: z.string().cuid().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilterInput = z.infer<typeof productFilterSchema>;
