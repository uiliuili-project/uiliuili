import type { AuthUser } from './types';

export function can(user: AuthUser | null | undefined, permission: string): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function canAny(user: AuthUser | null | undefined, permissions: string[]): boolean {
  return Boolean(user && permissions.some((permission) => user.permissions.includes(permission)));
}
