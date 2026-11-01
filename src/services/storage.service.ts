import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { env } from '../config/env';
import { BusinessError, SystemError } from '../lib/errors';
import { matchesImageSignature } from '../utils/image-signature';
import { buildFolderFileUrl } from '../utils/delivery-url';
import {
  catalogueFileName,
  catalogueObjectName,
  extensionForMime,
  isSafeFolder,
  mimeForExtension,
  type ImageExtension,
  type ImagePurpose,
} from '../utils/object-key';
import crypto from 'crypto';
import path from 'path';
import slugify from 'slugify';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY,
    secretAccessKey: env.R2_SECRET_KEY,
  },
  // Recent AWS SDK versions attach checksum headers that break browser and R2 uploads.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
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
    folder?: string,
    prefix?: string
  ): Promise<string> {
    if (!env.R2_ACCOUNT_ID || !env.R2_BUCKET || !env.R2_ACCESS_KEY || !env.R2_SECRET_KEY) {
      throw new BusinessError('File storage is not configured');
    }

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
    const uniqueId = crypto.randomUUID();
    const slug = prefix
      ? slugify(prefix, { lower: true, strict: true, trim: true })
      : '';
    const uniqueName = slug ? `${slug}-${uniqueId}${ext}` : `${uniqueId}${ext}`;
    const key = folder ? `${folder}/${uniqueName}` : uniqueName;

    await s3.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    // Return only the file name to store in DB
    return uniqueName;
  }

  async delete(fileNameOrKey: string, folder?: string): Promise<void> {
    const key = folder && !fileNameOrKey.includes('/')
      ? `${folder}/${fileNameOrKey}`
      : fileNameOrKey;
    await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  }

  async getSignedUrl(fileNameOrKey: string, folder?: string, expiresIn = 3600): Promise<string> {
    const key = folder && !fileNameOrKey.includes('/')
      ? `${folder}/${fileNameOrKey}`
      : fileNameOrKey;
    const command = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
  }

  folders(): { category: string; service: string } {
    return {
      category: env.R2_PUBLIC_FOLDER_CATEGORY,
      service: env.R2_PUBLIC_FOLDER_PRODUCT,
    };
  }

  deliveryUrl(storedName: string | null | undefined, purpose: ImagePurpose): string | null {
    if (!storedName) return null;
    const fileName = catalogueFileName(storedName);
    if (!fileName) return null;
    const folder = purpose === 'category' ? this.folders().category : this.folders().service;
    return buildFolderFileUrl(env.R2_PUBLIC_URL, folder, fileName, env.NODE_ENV !== 'production');
  }

  objectKey(storedName: string, purpose: ImagePurpose): string | null {
    const fileName = catalogueFileName(storedName);
    const folder = purpose === 'category' ? this.folders().category : this.folders().service;
    if (!fileName || !isSafeFolder(folder)) return null;
    return `${folder}/${fileName}`;
  }

  private assertStorageReady(): void {
    if (!env.R2_ACCOUNT_ID || !env.R2_BUCKET || !env.R2_ACCESS_KEY || !env.R2_SECRET_KEY) {
      throw new BusinessError('File storage is not configured');
    }
    const folders = this.folders();
    if (!isSafeFolder(folders.category) || !isSafeFolder(folders.service) || folders.category === folders.service) {
      throw new BusinessError('Image folders are not configured safely');
    }
  }

  async createPresignedUpload(
    purpose: ImagePurpose,
    contentType: string,
    contentLength: number
  ): Promise<{ uploadUrl: string; imageKey: string; contentType: string; expiresIn: number }> {
    this.assertStorageReady();
    const extension = extensionForMime(contentType);
    if (!extension) throw new BusinessError('Use a JPEG, PNG, or WebP image');
    if (contentLength < 1 || contentLength > MAX_SIZE) {
      throw new BusinessError('Image is too large');
    }
    const folder = purpose === 'category' ? this.folders().category : this.folders().service;
    const imageKey = `${folder}/${crypto.randomUUID()}.${extension}`;
    const expiresIn = 120;
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: imageKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
    return { uploadUrl, imageKey, contentType, expiresIn };
  }

  async uploadCatalogueImage(
    buffer: Buffer,
    purpose: ImagePurpose,
    slug: string
  ): Promise<{ imageKey: string; imageUrl: string | null }> {
    this.assertStorageReady();
    if (buffer.length < 1 || buffer.length > MAX_SIZE) {
      throw new BusinessError('Image is too large');
    }
    const source = (['jpg', 'png', 'webp'] as const).find((candidate) => matchesImageSignature(buffer, candidate));
    if (!source || !ALLOWED_MIMES.has(mimeForExtension(source))) {
      throw new BusinessError('File content is not a valid JPEG, PNG, or WebP image');
    }

    const webp = await this.toWebp(buffer);
    if (webp.length < 1 || webp.length > MAX_SIZE || !matchesImageSignature(webp, 'webp')) {
      throw new BusinessError('Could not convert the image to WebP');
    }

    const fileName = catalogueObjectName(slug, crypto.randomUUID());
    const folder = purpose === 'category' ? this.folders().category : this.folders().service;
    if (!fileName || !isSafeFolder(folder)) throw new BusinessError('Enter a name that can be used in a URL');
    const objectKey = `${folder}/${fileName}`;
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: objectKey,
          Body: webp,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
    } catch {
      throw new SystemError('Could not store the image');
    }

    return { imageKey: fileName, imageUrl: this.deliveryUrl(fileName, purpose) };
  }

  async verifyUploadedImage(storedName: string, purpose: ImagePurpose): Promise<{
    imageKey: string;
    imageUrl: null;
  }> {
    this.assertStorageReady();
    const fileName = catalogueFileName(storedName);
    const objectKey = fileName ? this.objectKey(fileName, purpose) : null;
    if (!fileName || !objectKey || fileName !== storedName) {
      throw new BusinessError('Image file name is not valid');
    }
    const extension: ImageExtension = fileName.endsWith('.png') ? 'png' : fileName.endsWith('.jpg') ? 'jpg' : 'webp';

    let head;
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey }));
    } catch {
      throw new BusinessError('Upload was not found. Choose the image again.');
    }

    const size = head.ContentLength ?? 0;
    if (size < 1 || size > MAX_SIZE) {
      await this.deleteOwnedObject(objectKey);
      throw new BusinessError('Image is too large');
    }
    if (head.ContentType && head.ContentType.split(';')[0]?.trim() !== mimeForExtension(extension)) {
      await this.deleteOwnedObject(objectKey);
      throw new BusinessError('Image type does not match the uploaded file');
    }

    let bytes: Uint8Array;
    try {
      const object = await s3.send(
        new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey, Range: 'bytes=0-31' })
      );
      if (!object.Body || !('transformToByteArray' in object.Body)) {
        throw new Error('empty body');
      }
      bytes = await object.Body.transformToByteArray();
    } catch {
      throw new BusinessError('Could not read the uploaded image');
    }

    if (!matchesImageSignature(bytes, extension)) {
      await this.deleteOwnedObject(objectKey);
      throw new BusinessError('File content is not a valid JPEG, PNG, or WebP image');
    }

    return { imageKey: fileName, imageUrl: null };
  }

  async deleteCatalogueImage(storedName: string, purpose: ImagePurpose): Promise<void> {
    const objectKey = this.objectKey(storedName, purpose);
    if (!objectKey) return;
    await this.deleteOwnedObject(objectKey);
  }

  private async toWebp(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000, animated: false })
        .rotate()
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
    } catch {
      throw new BusinessError('File content is not a valid JPEG, PNG, or WebP image');
    }
  }

  private async deleteOwnedObject(key: string): Promise<void> {
    const folders = this.folders();
    const fileName = catalogueFileName(key);
    const folder = key.slice(0, key.lastIndexOf('/'));
    if (!fileName || (folder !== folders.category && folder !== folders.service)) return;
    await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: `${folder}/${fileName}` })).catch(() => undefined);
  }
}

export const storageService = new StorageService();
