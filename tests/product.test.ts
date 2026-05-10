import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/products', () => {
  it('returns 200 with success:true', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: unknown[]; meta: unknown }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
  });

  it('respects pagination params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products?page=1&limit=5',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ meta: { limit: number; page: number } }>();
    expect(body.meta.limit).toBe(5);
    expect(body.meta.page).toBe(1);
  });

  it('rejects invalid pagination (limit > 100)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products?limit=999',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/products/:slug', () => {
  it('returns 404 for non-existent slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products/this-product-does-not-exist-xyz',
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/v1/products', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      payload: { name: 'Test Product' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with fake token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: { authorization: 'Bearer fake.token.here' },
      payload: { name: 'Test Product' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/categories', () => {
  it('returns 200 with category list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/categories' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: unknown[] }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
