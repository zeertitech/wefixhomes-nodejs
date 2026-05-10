import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { prisma } from '../config/prisma';

describe('Authentication Flow Integration Test', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    // Clear test user if exists
    await prisma.user.deleteMany({ where: { email: 'test@example.com' } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: 'test@example.com' } });
    await app.close();
  });

  it('should complete the full auth lifecycle', async () => {
    // 1. Register
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(registerRes.statusCode).toBe(201);
    const registerBody = JSON.parse(registerRes.payload);
    expect(registerBody.data.role).toBe('CUSTOMER');
    expect(typeof registerBody.data.roleId).toBe('number');
    expect(registerBody.data.roleId).toBeGreaterThan(0);

    // 2. Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'Password123!',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginData = JSON.parse(loginRes.payload).data;
    const token = loginData.accessToken;
    expect(token).toBeDefined();

    // 3. Verify Identity (Protected Route)
    const profileRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(profileRes.statusCode).toBe(200);
    const profileData = JSON.parse(profileRes.payload).data;
    expect(profileData.email).toBe('test@example.com');
  });

  describe('Registration Edge Cases', () => {
    it('should fail when registering with an existing email', async () => {
      // Create user first
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@example.com',
          password: 'Password123!',
          firstName: 'Original',
          lastName: 'User',
        },
      });

      // Try to create again
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@example.com',
          password: 'Password123!',
          firstName: 'I am a clone',
          lastName: 'User',
        },
      });

      expect(res.statusCode).toBe(409); // Conflict
      const body = JSON.parse(res.payload);
      expect(body.message).toMatch(/already exists/i);
    });

    it('should fail when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'missing@example.com',
          // firstName is missing
        },
      });

      expect(res.statusCode).toBe(400); // Bad Request (Zod validation)
    });
  });

  describe('Login Edge Cases', () => {
    it('should fail with incorrect password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'WrongPassword!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.message).toMatch(/invalid/i);
    });

    it('should fail with non-existent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nobody@example.com',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Authorization Edge Cases', () => {
    it('should fail to access /me without a token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should fail to access /me with a malformed token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer NOT_A_REAL_TOKEN',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
