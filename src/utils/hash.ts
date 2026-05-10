import argon2 from 'argon2';
import crypto from 'crypto';
import { env } from '../config/env';

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function hashPassword(password: string, salt?: string): Promise<string> {
  const peppered = password + env.PEPPER_SECRET;
  const options: argon2.Options & { salt?: Buffer } = {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  };

  if (salt) {
    options.salt = Buffer.from(salt, 'hex');
  }

  const hash = await argon2.hash(peppered, options);
  return hash.toString();
}

export async function verifyPassword(password: string, hash: string, _salt: string): Promise<boolean> {
  const peppered = password + env.PEPPER_SECRET;
  // Argon2 verify handles the salt automatically as it's encoded in the hash string
  return argon2.verify(hash, peppered);
}

export function generateSecureToken(): string {
  return crypto.randomBytes(40).toString('hex');
}
