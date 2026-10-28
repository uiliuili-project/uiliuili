import { type Permission, ROLE_PERMISSIONS, type UserGroup, type UserRole } from './constants';

const CREATOR_ROLES: UserRole[] = ['UPLOADER'];

/**
 * Derives the persisted user group from a role list. Roles remain the only
 * security boundary; the group merely decides which interface a user enters.
 */
export function userGroupForRoles(roles: UserRole[] = []): UserGroup {
  if (roles.includes('SUPER_ADMIN')) return 'OWNER';
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('REVIEWER')) return 'REVIEWER';
  if (roles.some((role) => CREATOR_ROLES.includes(role))) return 'CREATOR';
  return 'USER';
}

/** True for groups that may open the management console. */
export function isAdminGroup(group: UserGroup | string | null | undefined): boolean {
  return group === 'ADMIN' || group === 'OWNER';
}

export function isOwnerGroup(group: UserGroup | string | null | undefined): boolean {
  return group === 'OWNER';
}

export function isReviewerGroup(group: UserGroup | string | null | undefined): boolean {
  return group === 'REVIEWER';
}

/** True for every group with staff-level moderation access. */
export function isStaffGroup(group: UserGroup | string | null | undefined): boolean {
  return group === 'REVIEWER' || isAdminGroup(group);
}

export type ConsoleArea = 'review' | 'admin' | 'owner' | null;

export function consoleAreaForGroup(group: UserGroup | string | null | undefined): ConsoleArea {
  if (group === 'OWNER') return 'owner';
  if (group === 'ADMIN') return 'admin';
  if (group === 'REVIEWER') return 'review';
  return null;
}

export function permissionsForRoles(roles: UserRole[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      permissions.add(permission);
    }
  }
  return [...permissions];
}

export function hasPermission(roles: UserRole[], permission: Permission): boolean {
  return permissionsForRoles(roles).includes(permission);
}

export function hasAnyPermission(roles: UserRole[], permissions: Permission[]): boolean {
  const granted = permissionsForRoles(roles);
  return permissions.some((permission) => granted.includes(permission));
}

export function canManageVideo(
  roles: UserRole[],
  video: { uploaderId: string },
  userId?: string,
): boolean {
  if (permissionsForRoles(roles).includes('video:manage_any')) return true;
  return Boolean(userId && video.uploaderId === userId);
}
