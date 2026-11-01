const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const FOLDER = /^[a-z0-9][a-z0-9_-]{0,40}$/;

export type ImagePurpose = 'category' | 'service';
export type ImageExtension = 'jpg' | 'png' | 'webp';

export interface ParsedObjectKey {
  purpose: ImagePurpose;
  extension: ImageExtension;
  key: string;
}

const NAMED_WEBP = new RegExp(`^[a-z0-9]+(?:-[a-z0-9]+)*-${UUID}\\.webp$`);
const LEGACY_FILE = new RegExp(`^${UUID}\\.(jpg|png|webp)$`);

export function isSafeFolder(folder: string): boolean {
  return FOLDER.test(folder);
}

export function catalogueFileName(value: string): string | null {
  if (!value || value.length > 180 || value.includes('\\') || value.includes('..') || value.includes('//')) return null;
  const fileName = value.includes('/') ? value.slice(value.lastIndexOf('/') + 1) : value;
  if (!fileName || fileName.length > 140) return null;
  if (NAMED_WEBP.test(fileName) || LEGACY_FILE.test(fileName)) return fileName;
  return null;
}

export function catalogueObjectName(slug: string, id: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  if (!new RegExp(`^${UUID}$`).test(id)) return null;
  return `${slug}-${id}.webp`;
}

export function parseObjectKey(
  key: string,
  folders: { category: string; service: string }
): ParsedObjectKey | null {
  if (!isSafeFolder(folders.category) || !isSafeFolder(folders.service)) return null;
  if (folders.category === folders.service) return null;
  if (key.length > 180 || key.includes('\\') || key.includes('..') || key.includes('//')) return null;

  const match = new RegExp(`^(${folders.category}|${folders.service})/${UUID}\\.(jpg|png|webp)$`).exec(key);
  if (!match) return null;
  const extension = match[2] as ImageExtension;
  const purpose: ImagePurpose = match[1] === folders.category ? 'category' : 'service';
  return { purpose, extension, key };
}

export function extensionForMime(mime: string): ImageExtension | null {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return null;
}

export function mimeForExtension(extension: ImageExtension): string {
  if (extension === 'jpg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  return 'image/webp';
}
