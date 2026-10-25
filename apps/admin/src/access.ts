import type { AuthUser } from './types';

const ADMIN_PERMISSIONS = [
  'video:manage_any',
  'danmaku:manage',
  'comment:manage',
  'user:manage',
  'settings:manage',
  'system:manage',
  'audit:read',
  'report:manage',
];

/**
 * Administrators always have access. Reviewers and other staff roles reach the
 * console through their moderation permissions, but the public entry is only
 * shown to users in the ADMIN group.
 */
export function canAccessAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.group === 'ADMIN') return true;
  return user.permissions.some((permission) => ADMIN_PERMISSIONS.includes(permission));
}
