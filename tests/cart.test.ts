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

describe('GET /api/v1/cart', () => {
  it('creates a new cart when no ids are provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/cart' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; items: unknown[] } }>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it('creates a session cart with sessionId param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/cart?sessionId=test-session-abc',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { sessionId: string | null } }>();
    expect(body.data.sessionId).toBe('test-session-abc');
  });
});

describe('POST /api/v1/cart/:cartId/items', () => {
  it('returns 400 for missing variantId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/fake-cart-id/items',
      payload: { quantity: 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for quantity = 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/fake-cart-id/items',
      payload: { variantId: 'clxxxxxxxxxxxxxxxxxxx', quantity: 0 },
    });
    expect(res.statusCode).toBe(400);
  });
});
