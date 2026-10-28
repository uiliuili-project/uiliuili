import type { ConsoleArea } from '@uiliuili/shared';
import type { AuthUser } from './types';

/**
 * The console area a user should land in. Kept local to the admin bundle so
 * the Vite build does not need runtime exports from the shared CommonJS
 * package.
 */
export function consoleArea(user: AuthUser | null): ConsoleArea {
  const group = user?.group;
  if (group === 'OWNER') return 'owner';
  if (group === 'ADMIN') return 'admin';
  if (group === 'REVIEWER') return 'review';
  return null;
}

export function canAccessAdmin(user: AuthUser | null): boolean {
  return consoleArea(user) !== null;
}

/** Landing route for the current user's console area. */
export function consoleHome(user: AuthUser | null): string {
  const area = consoleArea(user);
  if (area === 'review') return '/review';
  return '/';
}
