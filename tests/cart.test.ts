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

function cartCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const match = cookies.find((cookie) => cookie.startsWith('cartSession='));
  if (!match) throw new Error('cartSession cookie was not set');
  return match.split(';')[0];
}

describe('GET /api/v1/cart', () => {
  it('creates a guest cart and sets an httpOnly session cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/cart' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      success: boolean;
      data: { id: string; items: unknown[]; summary: { itemCount: number; currency: string } };
    }>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.summary.currency).toBe('INR');
    expect(body.data).not.toHaveProperty('sessionId');

    const cookie = cartCookie(res);
    expect(cookie.startsWith('cartSession=')).toBe(true);
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/i);
  });

  it('returns the same cart for the same session cookie and ignores a client session id', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/v1/cart' });
    const cookie = cartCookie(first);
    const firstId = first.json<{ data: { id: string } }>().data.id;

    const second = await app.inject({
      method: 'GET',
      url: '/api/v1/cart?sessionId=test-session-abc&userId=someone-else',
      headers: { cookie },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json<{ data: { id: string } }>().data.id).toBe(firstId);
  });
});

describe('POST /api/v1/cart/items', () => {
  it('returns 400 for missing variantId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { quantity: 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for quantity = 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { variantId: 'clxxxxxxxxxxxxxxxxxxx', quantity: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('does not accept a cart id in the URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/fake-cart-id/items',
      payload: { variantId: 'clxxxxxxxxxxxxxxxxxxx', quantity: 1 },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/v1/cart/merge', () => {
  it('requires a logged-in session', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/cart/merge', payload: {} });
    expect(res.statusCode).toBe(401);
  });
});
