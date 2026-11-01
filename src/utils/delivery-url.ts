import { catalogueFileName, isSafeFolder, parseObjectKey } from './object-key';

export function buildDeliveryUrl(
  base: string,
  key: string,
  folders: { category: string; service: string },
  allowInsecureHttp: boolean
): string | null {
  const parsed = parseObjectKey(key, folders);
  if (!parsed) return null;
  const trimmed = base.trim().replace(/\/$/, '');
  const protocol = allowInsecureHttp ? /^https?:\/\//i : /^https:\/\//i;
  if (!protocol.test(trimmed) || trimmed.includes('..')) return null;
  try {
    const url = new URL(trimmed);
    if (url.username || url.password || url.search || url.hash) return null;
  } catch {
    return null;
  }
  const encoded = parsed.key.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${trimmed}/${encoded}`;
}

export function buildFolderFileUrl(
  base: string,
  folder: string,
  fileName: string,
  allowInsecureHttp: boolean
): string | null {
  if (!isSafeFolder(folder) || catalogueFileName(fileName) !== fileName) return null;
  const trimmed = base.trim().replace(/\/$/, '');
  const protocol = allowInsecureHttp ? /^https?:\/\//i : /^https:\/\//i;
  if (!protocol.test(trimmed) || trimmed.includes('..')) return null;
  try {
    const url = new URL(trimmed);
    if (url.username || url.password || url.search || url.hash) return null;
  } catch {
    return null;
  }
  return `${trimmed}/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`;
}
