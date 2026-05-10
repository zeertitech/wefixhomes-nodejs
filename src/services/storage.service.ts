import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { BusinessError } from '../lib/errors';
import crypto from 'crypto';
import path from 'path';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY,
    secretAccessKey: env.R2_SECRET_KEY,
  },
});

const ALLOWED_MIMES = new Set(env.ALLOWED_MIME_TYPES.split(',').map((m) => m.trim()));
const MAX_SIZE = parseInt(env.MAX_FILE_SIZE, 10);

const EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export class StorageService {
  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'products'
  ): Promise<string> {
    if (!ALLOWED_MIMES.has(mimeType)) {
      throw new BusinessError(
        `File type "${mimeType}" is not allowed. Allowed: ${[...ALLOWED_MIMES].join(', ')}`
      );
    }

    if (buffer.length > MAX_SIZE) {
      const mb = (MAX_SIZE / 1024 / 1024).toFixed(1);
      throw new BusinessError(`File exceeds the maximum allowed size of ${mb}MB`);
    }

    const ext = EXT_MAP[mimeType] ?? path.extname(originalName).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const key = `${folder}/${uniqueName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    return `${env.R2_PUBLIC_URL}/${key}`;
  }

  async delete(url: string): Promise<void> {
    const key = url.replace(`${env.R2_PUBLIC_URL}/`, '');
    await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
  }
}

export const storageService = new StorageService();
