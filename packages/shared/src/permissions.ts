import { type Permission, ROLE_PERMISSIONS, type UserRole } from './constants';

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
