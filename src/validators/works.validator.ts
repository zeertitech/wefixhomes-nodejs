import { z } from 'zod';
import { catalogueFileName } from '../utils/object-key';
import { CUID_PATTERN, SLUG_PATTERN } from './catalogue.validator';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

const slugField = z.string().trim().min(1).max(80).regex(SLUG_PATTERN, 'Use lowercase letters, numbers, and hyphens');
const sortOrderField = z.coerce.number().int().min(0).max(9999);
const categoryIdField = z.string().trim().regex(CUID_PATTERN, 'Choose a category');

const imageFileField = z
  .string()
  .trim()
  .max(180)
  .refine((value) => catalogueFileName(value) === value, 'Image file name is not valid');

const completionDateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Enter a valid date')
  .nullable()
  .optional()
  .transform((value) => value || null);

export const workImageInputSchema = z.object({
  imageKey: imageFileField,
  altText: optionalText(160),
  kind: z.enum(['GALLERY', 'BEFORE', 'AFTER']).default('GALLERY'),
});

const imagesField = z
  .array(workImageInputSchema)
  .max(20, 'Add 20 images or fewer')
  .superRefine((images, ctx) => {
    if (new Set(images.map((image) => image.imageKey)).size !== images.length) {
      ctx.addIssue({ code: 'custom', message: 'Each image can be added only once' });
    }
    for (const kind of ['BEFORE', 'AFTER'] as const) {
      if (images.filter((image) => image.kind === kind).length > 1) {
        ctx.addIssue({ code: 'custom', message: `Use only one ${kind.toLowerCase()} image` });
      }
    }
  });

const workFields = {
  title: z.string().trim().min(1, 'Enter a project title').max(140),
  slug: slugField.optional(),
  categoryId: categoryIdField,
  shortDescription: optionalText(300),
  description: optionalText(8000),
  coverImage: imageFileField.nullable().optional(),
  location: optionalText(120),
  propertyType: optionalText(80),
  completionDate: completionDateField,
  isFeatured: z.boolean().optional().default(false),
  sortOrder: sortOrderField.optional().default(0),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional().default('DRAFT'),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
  seoKeywords: optionalText(255),
  images: imagesField.optional(),
};

export const createWorkSchema = z.object(workFields);

export const updateWorkSchema = z
  .object({
    title: workFields.title.optional(),
    slug: slugField.optional(),
    categoryId: categoryIdField.optional(),
    shortDescription: optionalText(300),
    description: optionalText(8000),
    coverImage: imageFileField.nullable().optional(),
    location: optionalText(120),
    propertyType: optionalText(80),
    completionDate: completionDateField,
    isFeatured: z.boolean().optional(),
    sortOrder: sortOrderField.optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    seoKeywords: optionalText(255),
    images: imagesField.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

const searchField = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((value) => (value ? value.replace(/\0/g, '') : undefined));

const boolQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

const optionalSlug = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  slugField.optional(),
);

const pageFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: searchField,
  featured: boolQuery,
  order: z.enum(['asc', 'desc']).default('asc'),
};

export const publicWorkQuerySchema = z.object({
  ...pageFields,
  category: optionalSlug,
});

export const adminWorkQuerySchema = z.object({
  ...pageFields,
  categoryId: categoryIdField.optional(),
  status: z.enum(['all', 'DRAFT', 'PUBLISHED']).default('all'),
  sortBy: z.enum(['sortOrder', 'title', 'createdAt', 'completionDate']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateWorkInput = z.infer<typeof createWorkSchema>;
export type UpdateWorkInput = z.infer<typeof updateWorkSchema>;
export type PublicWorkQuery = z.infer<typeof publicWorkQuerySchema>;
export type AdminWorkQuery = z.infer<typeof adminWorkQuerySchema>;
