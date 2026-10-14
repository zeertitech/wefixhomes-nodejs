import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthError } from '../lib/errors';
import { COOKIE_NAMES, setAuthCookies } from '../utils/cookie';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { userRepository } from '../repositories/user.repository';
import { logger } from '../config/logger';
import type { JwtPayload } from '../types/auth';

export type { JwtPayload };

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/**
 * Attempts to silently rotate a new accessToken using the refreshToken cookie.
 * Returns the decoded payload of the new token, or throws AuthError if the
 * refreshToken is missing, expired, revoked, or belongs to an inactive user.
 *
 * On success it:
 *  1. Verifies the refreshToken JWT signature.
 *  2. Validates the token against the DB (must exist and not be expired/revoked).
 *  3. Issues a new accessToken and sets it as an httpOnly cookie on the response.
 *  4. Rotates the refreshToken — old token is invalidated, new one is stored & set.
 */
async function silentRefresh(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<JwtPayload> {
  const refreshToken = request.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];

  if (!refreshToken) {
    throw new AuthError('Session expired. Please log in again.');
  }

  // 1. Verify JWT signature first (fast, no DB hit)
  let decoded: JwtPayload;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('Invalid or expired refresh token. Please log in again.');
  }

  // 2. Validate against DB — check it hasn't been revoked or expired
  const stored = await userRepository.findRefreshToken(refreshToken);

  if (!stored) {
    logger.warn('Refresh token not found in DB (possible token reuse attack)', {
      userId: decoded.userId,
    });
    // Treat missing token as a potential replay attack — revoke all sessions
    await userRepository.deleteAllRefreshTokens(decoded.userId);
    throw new AuthError('Session is no longer valid. Please log in again.');
  }

  if (stored.expiresAt < new Date()) {
    await userRepository.deleteRefreshToken(refreshToken);
    throw new AuthError('Session expired. Please log in again.');
  }

  if (!stored.user.isActive) {
    throw new AuthError('Account is deactivated.');
  }

  const payload: JwtPayload = {
    userId: stored.user.id,
    role: (stored.user as any).role?.name ?? decoded.role,
    roleId: stored.user.roleId,
    email: stored.user.email,
  };

  // 3. Issue new tokens (Refresh Token Rotation)
  const newAccessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);

  // 4. Rotate in DB — delete old, insert new
  await userRepository.deleteRefreshToken(refreshToken);
  const newExpiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );
  await userRepository.createRefreshToken(payload.userId, newRefreshToken, newExpiresAt);

  // 5. Set new cookies on the response
  setAuthCookies(reply, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });

  logger.info('Silent token rotation successful', { userId: payload.userId });

  return payload;
}

/**
 * Fastify preHandler: authenticate + transparent token refresh.
 *
 * Flow:
 *  1. Look for accessToken in Authorization header or cookie.
 *  2. If found and valid → attach payload to request.user, continue.
 *  3. If missing or expired → attempt silent refresh via refreshToken cookie.
 *  4. If refresh succeeds → new cookies are set, continue with new payload.
 *  5. If refresh fails → throw 401 AuthError.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (request.cookies?.[COOKIE_NAMES.ACCESS_TOKEN]) {
    token = request.cookies[COOKIE_NAMES.ACCESS_TOKEN];
  }

  // If we have an accessToken, try to verify it first
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      request.user = payload;
      return;
    } catch (err: any) {
      // TokenExpiredError → attempt silent refresh below
      // Any other error (tampered/malformed) → reject immediately
      if (err?.name !== 'TokenExpiredError') {
        throw new AuthError('Invalid token. Please log in again.');
      }
      // Fall through to silent refresh
    }
  }

  // No valid accessToken — attempt silent refresh using refreshToken cookie
  try {
    request.user = await silentRefresh(request, reply);
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Authentication failed. Please log in again.');
  }
}

/**
 * Attaches request.user when a valid session exists.
 * Shoppers without a session continue as guests instead of receiving 401.
 */
export async function optionalAuthenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await authenticate(request, reply);
  } catch (err) {
    if (err instanceof AuthError) {
      request.user = undefined;
      return;
    }
    throw err;
  }
}
