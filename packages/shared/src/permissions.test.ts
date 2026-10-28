import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from './constants';
import {
  consoleAreaForGroup,
  hasPermission,
  isAdminGroup,
  isOwnerGroup,
  isReviewerGroup,
  isStaffGroup,
  permissionsForRoles,
  userGroupForRoles,
} from './permissions';

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

  it('keeps reviewers focused on moderation', () => {
    expect(hasPermission(['REVIEWER'], 'video:review')).toBe(true);
    expect(hasPermission(['REVIEWER'], 'comment:manage')).toBe(true);
    expect(hasPermission(['REVIEWER'], 'report:manage')).toBe(true);
    expect(hasPermission(['REVIEWER'], 'user:view')).toBe(false);
    expect(hasPermission(['REVIEWER'], 'settings:site')).toBe(false);
    expect(hasPermission(['REVIEWER'], 'owner:transfer')).toBe(false);
  });

  it('grants administrators content and user controls but not owner settings', () => {
    expect(hasPermission(['ADMIN'], 'user:moderate')).toBe(true);
    expect(hasPermission(['ADMIN'], 'settings:site')).toBe(true);
    expect(hasPermission(['ADMIN'], 'settings:content')).toBe(true);
    expect(hasPermission(['ADMIN'], 'video:feature')).toBe(true);
    expect(hasPermission(['ADMIN'], 'settings:integration')).toBe(false);
    expect(hasPermission(['ADMIN'], 'settings:security')).toBe(false);
    expect(hasPermission(['ADMIN'], 'system:operate')).toBe(false);
    expect(hasPermission(['ADMIN'], 'user:assign_role')).toBe(false);
    expect(hasPermission(['ADMIN'], 'owner:transfer')).toBe(false);
  });

  it('derives the persisted user group from roles', () => {
    expect(userGroupForRoles([])).toBe('USER');
    expect(userGroupForRoles(['USER'])).toBe('USER');
    expect(userGroupForRoles(['UPLOADER'])).toBe('CREATOR');
    expect(userGroupForRoles(['REVIEWER'])).toBe('REVIEWER');
    expect(userGroupForRoles(['ADMIN'])).toBe('ADMIN');
    expect(userGroupForRoles(['SUPER_ADMIN'])).toBe('OWNER');
    expect(userGroupForRoles(['USER', 'ADMIN'])).toBe('ADMIN');
    expect(userGroupForRoles(['ADMIN', 'SUPER_ADMIN'])).toBe('OWNER');
  });

  it('classifies console groups', () => {
    expect(isOwnerGroup('OWNER')).toBe(true);
    expect(isAdminGroup('ADMIN')).toBe(true);
    expect(isAdminGroup('OWNER')).toBe(true);
    expect(isAdminGroup('REVIEWER')).toBe(false);
    expect(isReviewerGroup('REVIEWER')).toBe(true);
    expect(isStaffGroup('REVIEWER')).toBe(true);
    expect(isStaffGroup('CREATOR')).toBe(false);
    expect(consoleAreaForGroup('OWNER')).toBe('owner');
    expect(consoleAreaForGroup('ADMIN')).toBe('admin');
    expect(consoleAreaForGroup('REVIEWER')).toBe('review');
    expect(consoleAreaForGroup('USER')).toBeNull();
    expect(consoleAreaForGroup(undefined)).toBeNull();
  });
});
