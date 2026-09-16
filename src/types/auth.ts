import type { UserRole } from '../models/user.model.js';

export interface AuthUser {
  id: string;
  role: UserRole;
}

export interface AuthTokenPayload {
  sub: string;
  type: 'access' | 'refresh';
  jti?: string;
}
