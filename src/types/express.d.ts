import 'express-serve-static-core';
import type { AuthUser } from './auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    user?: AuthUser;
  }
}
