import { z } from 'zod';
import { config } from 'dotenv';
import path from 'path';

// Load env files in priority order
const nodeEnv = process.env['NODE_ENV'] ?? 'development';
config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
config({ path: path.resolve(process.cwd(), '.env') }); // fallback

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_PREFIX: z.string().default('/api/v1'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
  COOKIE_SECRET: z.string().min(16).optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('WeFixHomes <noreply@wefixhomes.in>'),

  // Filled in later. Empty values keep the API running until OAuth is wired up.
  OAUTH2_PROVIDER: z.string().default('google'),
  OAUTH2_CLIENT_ID: z.string().default(''),
  OAUTH2_CLIENT_SECRET: z.string().default(''),
  OAUTH2_CALLBACK_URL: z.string().default(''),
  OAUTH2_ISSUER: z.string().default('https://accounts.google.com'),

  PEPPER_SECRET: z.string().min(32, 'PEPPER_SECRET must be at least 32 characters'),

  // Optional until image uploads are used. Empty values must not block startup.
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY: z.string().default(''),
  R2_SECRET_KEY: z.string().default(''),
  R2_BUCKET: z.string().default(''),
  R2_PUBLIC_URL: z.string().default(''),
  R2_PUBLIC_FOLDER_CATEGORY: z.string().default('categories'),
  R2_PUBLIC_FOLDER_PRODUCT: z.string().default('services'),
  R2_PUBLIC_FOLDER_PROFILE: z.string().default('profile'),

  // Optional until payments, SMS, or shipping are mounted again.
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

  SMS_API_KEY: z.string().default(''),
  SMS_SENDER_ID: z.string().default(''),
  SMS_TEMPLATE_NAME: z.string().default('ORDERCONF'),

  SHIPROCKET_EMAIL: z.string().default(''),
  SHIPROCKET_PASSWORD: z.string().default(''),

  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  MAX_FILE_SIZE: z.string().default('5242880'),
  ALLOWED_MIME_TYPES: z.string().default('image/jpeg,image/png,image/webp'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Invalid environment variables:\n');
  const errors = parsed.error.flatten().fieldErrors;
  for (const [key, messages] of Object.entries(errors)) {
    console.error(`  ${key}: ${messages?.join(', ')}`);
  }
  console.error('\nPlease check your .env.development file.\n');
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
