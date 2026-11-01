import { z } from 'zod';
import { env } from '../config/env';
import { parseMoney } from '../utils/money';
import { catalogueFileName, extensionForMime } from '../utils/object-key';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CUID_PATTERN = /^c[a-z0-9]{24}$/;

const maxUploadBytes = () => {
  const parsed = Number.parseInt(env.MAX_FILE_SIZE, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_242_880;
};

export const moneySchema = z.preprocess((value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const paise = Math.round(value * 100);
    if (paise < 0) return value;
    const whole = Math.trunc(paise / 100);
    const fraction = String(Math.abs(paise % 100)).padStart(2, '0');
    return `${whole}.${fraction}`;
  }
  return value;
}, z.string().trim().regex(/^\d{1,8}(?:\.\d{1,2})?$/, 'Enter a valid price in rupees').transform((value) => {
  const parsed = parseMoney(value);
  if (!parsed) return value;
  return parsed.amount;
}));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers, and hyphens');

const sortOrderField = z.coerce.number().int().min(0).max(9999);

function pricesFit(mrp: string, sellingPrice: string, ctx: z.RefinementCtx): void {
  const mrpMoney = parseMoney(mrp);
  const sellingMoney = parseMoney(sellingPrice);
  if (!mrpMoney || !sellingMoney) return;
  if (sellingMoney.paise > mrpMoney.paise) {
    ctx.addIssue({
      code: 'custom',
      path: ['sellingPrice'],
      message: 'Selling price cannot be greater than MRP',
    });
  }
}

const imageFileField = z
  .string()
  .trim()
  .max(180)
  .refine((value) => catalogueFileName(value) === value, 'Image file name is not valid')
  .nullable()
  .optional();

const categoryFields = {
  name: z.string().trim().min(1, 'Enter a category name').max(120),
  slug: slugField.optional(),
  description: optionalText(2000),
  note: optionalText(300),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
  seoKeywords: optionalText(255),
  isActive: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  sortOrder: sortOrderField.optional().default(0),
  imageKey: imageFileField,
};

export const createCategorySchema = z.object(categoryFields);

export const updateCategorySchema = z
  .object({
    name: categoryFields.name.optional(),
    slug: slugField.optional(),
    description: optionalText(2000),
    note: optionalText(300),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    seoKeywords: optionalText(255),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: sortOrderField.optional(),
    imageKey: imageFileField,
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

const labelIdField = z.string().trim().regex(CUID_PATTERN, 'Choose a valid label');

const labelIdsField = z
  .array(labelIdField)
  .max(20, 'Choose 20 labels or fewer')
  .optional();

function uniqueLabelIds(labelIds: string[] | undefined, ctx: z.RefinementCtx): void {
  if (!labelIds) return;
  if (new Set(labelIds).size !== labelIds.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['labelIds'],
      message: 'Choose each label only once',
    });
  }
}

const serviceFields = {
  categoryId: z.string().trim().regex(CUID_PATTERN, 'Choose a category'),
  name: z.string().trim().min(1, 'Enter a service name').max(120),
  slug: slugField.optional(),
  shortDescription: optionalText(300),
  description: optionalText(5000),
  mrp: moneySchema,
  sellingPrice: moneySchema,
  isActive: z.boolean().optional().default(true),
  sortOrder: sortOrderField.optional().default(0),
  imageKey: imageFileField,
  labelIds: labelIdsField,
};

export const createServiceSchema = z.object(serviceFields).superRefine((value, ctx) => {
  pricesFit(value.mrp, value.sellingPrice, ctx);
  uniqueLabelIds(value.labelIds, ctx);
});

export const updateServiceSchema = z
  .object({
    categoryId: serviceFields.categoryId.optional(),
    name: serviceFields.name.optional(),
    slug: slugField.optional(),
    shortDescription: optionalText(300),
    description: optionalText(5000),
    mrp: moneySchema.optional(),
    sellingPrice: moneySchema.optional(),
    isActive: z.boolean().optional(),
    sortOrder: sortOrderField.optional(),
    imageKey: imageFileField,
    labelIds: labelIdsField,
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
  .superRefine((value, ctx) => {
    if (value.mrp !== undefined && value.sellingPrice !== undefined) {
      pricesFit(value.mrp, value.sellingPrice, ctx);
    }
    uniqueLabelIds(value.labelIds, ctx);
  });

const labelFields = {
  name: z.string().trim().min(1, 'Enter a label name').max(80),
  slug: slugField.optional(),
  description: optionalText(500),
  isActive: z.boolean().optional().default(true),
  sortOrder: sortOrderField.optional().default(0),
};

export const createLabelSchema = z.object(labelFields);

export const updateLabelSchema = z
  .object({
    name: labelFields.name.optional(),
    slug: slugField.optional(),
    description: optionalText(500),
    isActive: z.boolean().optional(),
    sortOrder: sortOrderField.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

const searchField = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((value) => (value ? value.replace(/\0/g, '') : undefined));

export const cataloguePageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: searchField,
});

export const publicCategoryQuerySchema = cataloguePageSchema.extend({
  sortBy: z.enum(['sortOrder', 'name']).default('sortOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const optionalSlug = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  slugField.optional(),
);

export const publicServiceQuerySchema = cataloguePageSchema
  .extend({
    category: optionalSlug,
    label: optionalSlug,
    sortBy: z.enum(['sortOrder', 'name']).default('sortOrder'),
    order: z.enum(['asc', 'desc']).default('asc'),
  })
  .superRefine((value, ctx) => {
    if (value.label && !value.category) {
      ctx.addIssue({
        code: 'custom',
        path: ['label'],
        message: 'Choose a category before filtering by label',
      });
    }
  });

export const publicCategoryServicesQuerySchema = cataloguePageSchema.extend({
  label: optionalSlug,
  sortBy: z.enum(['sortOrder', 'name']).default('sortOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const adminLabelQuerySchema = z.object({
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});

export const adminCategoryQuerySchema = cataloguePageSchema.extend({
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  sortBy: z.enum(['sortOrder', 'name', 'createdAt']).default('sortOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const adminServiceQuerySchema = adminCategoryQuerySchema.extend({
  categoryId: z.string().trim().regex(CUID_PATTERN).optional(),
  sortBy: z.enum(['sortOrder', 'name', 'createdAt', 'sellingPrice']).default('sortOrder'),
});

export const idParamSchema = z.object({
  id: z.string().trim().regex(CUID_PATTERN, 'Invalid id'),
});

export const slugParamSchema = z.object({
  slug: slugField,
});

export const categoryIdParamSchema = z.object({
  categoryId: z.string().trim().regex(CUID_PATTERN, 'Invalid category'),
});

export const categoryLabelParamSchema = categoryIdParamSchema.extend({
  labelId: z.string().trim().regex(CUID_PATTERN, 'Invalid label'),
});

export const uploadPurposeSchema = z.object({
  purpose: z.enum(['category', 'service']),
  slug: slugField,
});

export const presignUploadSchema = z.object({
  purpose: z.enum(['category', 'service']),
  contentType: z.string().trim().refine((value) => extensionForMime(value) !== null, {
    message: 'Use a JPEG, PNG, or WebP image',
  }),
  contentLength: z.coerce.number().int().min(1).max(maxUploadBytes(), 'Image is too large'),
});

export const confirmUploadSchema = z.object({
  imageKey: z.string().trim().min(3).max(180),
  contentType: z.string().trim().refine((value) => extensionForMime(value) !== null, {
    message: 'Use a JPEG, PNG, or WebP image',
  }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type PublicCategoryQuery = z.infer<typeof publicCategoryQuerySchema>;
export type PublicServiceQuery = z.infer<typeof publicServiceQuerySchema>;
export type PublicCategoryServicesQuery = z.infer<typeof publicCategoryServicesQuerySchema>;
export type AdminCategoryQuery = z.infer<typeof adminCategoryQuerySchema>;
export type AdminServiceQuery = z.infer<typeof adminServiceQuerySchema>;
export type AdminLabelQuery = z.infer<typeof adminLabelQuerySchema>;
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
