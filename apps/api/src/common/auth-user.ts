import type { UserGroup, UserRole } from '@uiliuili/shared';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  roles: UserRole[];
  group: UserGroup;
  permissions: string[];
  level: number;
  experience?: number;
  emailVerified: boolean;
  banned: boolean;
  mutedUntil: Date | null;
  coinBalance: number;
  region: string;
  showRestricted: boolean;
  coverUrl: string | null;
}

export interface RequestWithUser {
  user?: AuthUser;
  cookies?: Record<string, string>;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  id?: string;
}
