import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env';

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  domain?: string;
  maxAge: number;
}

/**
 * Parses time strings like '15m', '7d', '1h', '60s' into seconds.
 */
function parseDurationToSeconds(duration: string, fallbackSeconds: number): number {
  const match = duration.match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackSeconds;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return val;
    case 'm':
      return val * 60;
    case 'h':
      return val * 3600;
    case 'd':
      return val * 86400;
    default:
      return fallbackSeconds;
  }
}

/**
 * Calculates cookie security attributes based on the current execution environment.
 *
 * Strict Security Specifications:
 * 1. httpOnly: true
 *    Mitigates Cross-Site Scripting (XSS) by preventing JavaScript (`document.cookie`)
 *    from reading authentication tokens.
 *
 * 2. secure: true in production / HTTPS
 *    Ensures tokens are only transmitted over TLS/HTTPS channels, preventing
 *    sniffing or man-in-the-middle attacks. In local development (HTTP),
 *    it is disabled so browsers on http://localhost do not reject the cookie.
 *
 * 3. sameSite:
 *    - In local development: 'lax' allows cross-port local development (e.g., Next.js
 *      on port 3000 communicating with Node.js on port 4000).
 *    - In production:
 *      * Uses COOKIE_SAME_SITE if explicitly set ('lax' | 'strict' | 'none').
 *      * If COOKIE_DOMAIN is provided (e.g. '.shanandralabel.com'), defaults to 'lax'
 *        for multi-subdomain sharing with robust CSRF protection.
 *      * Otherwise defaults to 'none' (with secure: true) to allow cross-origin cloud
 *        deployments (e.g. Vercel frontend calling a separate cloud API host).
 *
 * 4. domain:
 *    - In local development: undefined (browsers reject domain declarations on localhost).
 *    - In production: Uses COOKIE_DOMAIN if specified, otherwise host-only (undefined).
 *
 * 5. path: '/'
 *    Enables the session cookie across all API routes.
 */
export function getCookieOptions(type: 'access' | 'refresh'): CookieOptions {
  const isProduction = env.NODE_ENV === 'production';
  const secure = isProduction;

  let sameSite: 'lax' | 'strict' | 'none' = 'lax';
  if (isProduction) {
    if (env.COOKIE_SAME_SITE) {
      sameSite = env.COOKIE_SAME_SITE;
    } else if (env.COOKIE_DOMAIN) {
      sameSite = 'lax';
    } else {
      sameSite = 'none';
    }
  } else {
    sameSite = 'lax';
  }

  const domain = isProduction && env.COOKIE_DOMAIN ? env.COOKIE_DOMAIN : undefined;

  const maxAge =
    type === 'access'
      ? parseDurationToSeconds(env.JWT_EXPIRES_IN, 15 * 60)
      : parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60);

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    domain,
    maxAge,
  };
}

/**
 * Sets hardened authentication cookies on the Fastify response.
 */
export function setAuthCookies(
  reply: FastifyReply,
  tokens: { accessToken: string; refreshToken?: string }
): void {
  const accessOptions = getCookieOptions('access');
  reply.setCookie(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, accessOptions);

  if (tokens.refreshToken) {
    const refreshOptions = getCookieOptions('refresh');
    reply.setCookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshOptions);
  }
}

/**
 * Clears authentication cookies across the browser session.
 */
export function clearAuthCookies(reply: FastifyReply): void {
  const accessOptions = {
    ...getCookieOptions('access'),
    maxAge: 0,
    expires: new Date(0),
  };
  const refreshOptions = {
    ...getCookieOptions('refresh'),
    maxAge: 0,
    expires: new Date(0),
  };

  reply.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, accessOptions);
  reply.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, refreshOptions);
}

/**
 * Retrieves authentication tokens from incoming request cookies.
 */
export function getAuthCookies(request: FastifyRequest): {
  accessToken?: string;
  refreshToken?: string;
} {
  return {
    accessToken: request.cookies?.[COOKIE_NAMES.ACCESS_TOKEN],
    refreshToken: request.cookies?.[COOKIE_NAMES.REFRESH_TOKEN],
  };
}
