import { z } from 'zod';
import { catalogueFileName } from '../utils/object-key';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

const sortOrderField = z.coerce.number().int().min(0).max(9999);
const ratingField = z.coerce.number().int().min(1, 'Choose a rating from 1 to 5').max(5, 'Choose a rating from 1 to 5');

const imageFileField = z
  .string()
  .trim()
  .max(180)
  .refine((value) => catalogueFileName(value) === value, 'Image file name is not valid');

const testimonialFields = {
  customerName: z.string().trim().min(1, 'Enter the customer name').max(80),
  location: optionalText(120),
  quote: z.string().trim().min(1, 'Enter the review').max(600, 'Keep the review to 600 characters'),
  rating: ratingField.optional().default(5),
  avatarKey: imageFileField.nullable().optional(),
  sortOrder: sortOrderField.optional().default(0),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional().default('DRAFT'),
};

export const createTestimonialSchema = z.object(testimonialFields);

export const updateTestimonialSchema = z
  .object({
    customerName: testimonialFields.customerName.optional(),
    location: optionalText(120),
    quote: testimonialFields.quote.optional(),
    rating: ratingField.optional(),
    avatarKey: imageFileField.nullable().optional(),
    sortOrder: sortOrderField.optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

const searchField = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((value) => (value ? value.replace(/\0/g, '') : undefined));

const pageFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  order: z.enum(['asc', 'desc']).default('asc'),
};

export const publicTestimonialQuerySchema = z.object(pageFields);

export const adminTestimonialQuerySchema = z.object({
  ...pageFields,
  search: searchField,
  status: z.enum(['all', 'DRAFT', 'PUBLISHED']).default('all'),
  sortBy: z.enum(['sortOrder', 'customerName', 'createdAt']).default('sortOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;
export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>;
export type PublicTestimonialQuery = z.infer<typeof publicTestimonialQuerySchema>;
export type AdminTestimonialQuery = z.infer<typeof adminTestimonialQuerySchema>;
