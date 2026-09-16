import bcrypt from 'bcrypt';
import { AppError } from '../middleware/error-handler.js';
import { RefreshTokenModel } from '../models/refresh-token.model.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { LoginInput, RegisterInput } from '../validators/auth.validators.js';
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyRefreshToken,
} from '../utils/token.utils.js';

const PASSWORD_SALT_ROUNDS = 12;

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserDocument['role'];
    status: UserDocument['status'];
  };
  accessToken: string;
  refreshToken: string;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const existingUser = await UserModel.exists({ email: input.email });
  if (existingUser) {
    throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: 'ADMIN',
    status: 'ACTIVE',
  });

  return issueTokens(user);
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account is inactive');
  }

  return issueTokens(user);
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  if (!payload.jti) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  const storedToken = await RefreshTokenModel.findOne({
    tokenId: payload.jti,
    userId: payload.sub,
    revokedAt: { $exists: false },
  });

  if (!storedToken || storedToken.expiresAt <= new Date() || storedToken.tokenHash !== hashToken(refreshToken)) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  storedToken.revokedAt = new Date();
  await storedToken.save();
  return issueTokens(user);
}

export async function logout(refreshToken: string): Promise<void> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return;
  }

  if (!payload.jti) {
    return;
  }

  await RefreshTokenModel.updateOne(
    {
      tokenId: payload.jti,
      userId: payload.sub,
      tokenHash: hashToken(refreshToken),
      revokedAt: { $exists: false },
    },
    { $set: { revokedAt: new Date() } },
  );
}

export async function getCurrentUser(userId: string): Promise<AuthResponse['user']> {
  const user = await UserModel.findById(userId);
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
  }

  return serializeUser(user);
}

async function issueTokens(user: UserDocument): Promise<AuthResponse> {
  const accessToken = createAccessToken(user.id);
  const refresh = createRefreshToken(user.id);

  await RefreshTokenModel.create({
    userId: user._id,
    tokenId: refresh.tokenId,
    tokenHash: hashToken(refresh.token),
    expiresAt: refresh.expiresAt,
  });

  return {
    user: serializeUser(user),
    accessToken,
    refreshToken: refresh.token,
  };
}

function serializeUser(user: UserDocument): AuthResponse['user'] {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}
