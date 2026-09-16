import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AuthTokenPayload } from '../types/auth.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export function createAccessToken(userId: string): string {
  return jwt.sign({ type: 'access' }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function createRefreshToken(userId: string): { token: string; tokenId: string; expiresAt: Date } {
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const token = jwt.sign({ type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    jwtid: tokenId,
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });

  return { token, tokenId, expiresAt };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return verifyToken(token, env.JWT_ACCESS_SECRET, 'access');
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  return verifyToken(token, env.JWT_REFRESH_SECRET, 'refresh');
}

function verifyToken(token: string, secret: string, type: AuthTokenPayload['type']): AuthTokenPayload {
  const payload = jwt.verify(token, secret);
  if (typeof payload === 'string' || payload.type !== type || typeof payload.sub !== 'string') {
    throw new Error('Invalid token payload');
  }

  return { sub: payload.sub, type, jti: payload.jti };
}
