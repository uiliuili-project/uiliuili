import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from './constants';
import { hasPermission, isAdminGroup, permissionsForRoles, userGroupForRoles } from './permissions';

describe('permissions', () => {
  it('grants all permissions to super admins', () => {
    expect(permissionsForRoles(['SUPER_ADMIN']).sort()).toEqual([...PERMISSIONS].sort());
  });

  it('allows regular users to upload their own videos', () => {
    expect(hasPermission(['USER'], 'video:upload')).toBe(true);
    expect(hasPermission(['USER'], 'video:manage_own')).toBe(true);
    expect(hasPermission(['USER'], 'video:manage_any')).toBe(false);
  });

  it('does not grant admin moderation to uploaders', () => {
    expect(hasPermission(['UPLOADER'], 'danmaku:manage')).toBe(false);
    expect(hasPermission(['REVIEWER'], 'danmaku:manage')).toBe(true);
  });

  it('derives the persisted user group from roles', () => {
    expect(userGroupForRoles([])).toBe('USER');
    expect(userGroupForRoles(['USER'])).toBe('USER');
    expect(userGroupForRoles(['UPLOADER'])).toBe('CREATOR');
    expect(userGroupForRoles(['REVIEWER'])).toBe('CREATOR');
    expect(userGroupForRoles(['ADMIN'])).toBe('ADMIN');
    expect(userGroupForRoles(['SUPER_ADMIN'])).toBe('ADMIN');
    expect(userGroupForRoles(['USER', 'ADMIN'])).toBe('ADMIN');
    expect(isAdminGroup('ADMIN')).toBe(true);
    expect(isAdminGroup('CREATOR')).toBe(false);
    expect(isAdminGroup(undefined)).toBe(false);
  });
});
