import { type Permission, ROLE_PERMISSIONS, type UserGroup, type UserRole } from './constants';

const ADMIN_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];
const CREATOR_ROLES: UserRole[] = ['UPLOADER', 'REVIEWER'];

/**
 * Derives the persisted user group from a role list. Roles remain the only
 * security boundary; the group merely decides which interface a user enters.
 */
export function userGroupForRoles(roles: UserRole[] = []): UserGroup {
  if (roles.some((role) => ADMIN_ROLES.includes(role))) return 'ADMIN';
  if (roles.some((role) => CREATOR_ROLES.includes(role))) return 'CREATOR';
  return 'USER';
}

export function isAdminGroup(group: UserGroup | string | null | undefined): boolean {
  return group === 'ADMIN';
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
