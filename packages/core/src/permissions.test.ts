import { describe, expect, it } from 'vitest';
import { canManage, canModerateMessages, canRemove, canWrite } from './permissions.js';

describe('chat huquqlari', () => {
  it('canWrite: kanalda faqat owner/admin', () => {
    expect(canWrite('channel', 'member')).toBe(false);
    expect(canWrite('channel', 'admin')).toBe(true);
    expect(canWrite('channel', 'owner')).toBe(true);
    expect(canWrite('group', 'member')).toBe(true);
    expect(canWrite('direct', 'member')).toBe(true);
  });

  it('canManage / canModerateMessages: direct\'da hech kim, guruh/kanalda owner/admin', () => {
    expect(canManage('direct', 'owner')).toBe(false);
    expect(canManage('group', 'member')).toBe(false);
    expect(canManage('group', 'admin')).toBe(true);
    expect(canManage('channel', 'owner')).toBe(true);
    expect(canModerateMessages('direct', 'member')).toBe(false);
    expect(canModerateMessages('channel', 'admin')).toBe(true);
  });

  it('canRemove: egasini hech kim; admin faqat oddiy a\'zoni', () => {
    expect(canRemove('owner', 'owner')).toBe(false);
    expect(canRemove('owner', 'admin')).toBe(true);
    expect(canRemove('admin', 'admin')).toBe(false);
    expect(canRemove('admin', 'member')).toBe(true);
    expect(canRemove('member', 'member')).toBe(false);
  });
});
