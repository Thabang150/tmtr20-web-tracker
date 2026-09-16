import { HydratedDocument, Model, Schema, model } from 'mongoose';

export const USER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface User {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User, Model<User>>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: 'ADMIN' },
    status: { type: String, enum: USER_STATUSES, required: true, default: 'ACTIVE' },
  },
  { timestamps: true },
);

export const UserModel = model<User>('User', userSchema);
