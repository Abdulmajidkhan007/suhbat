import { describe, expect, it } from 'vitest';
import { ADMIN_BULK_DELETE_MAX, AdminBulkDeleteInputSchema, AdminUsersQuerySchema } from './admin.js';

describe('admin sxemalari', () => {
  it('ro\'yxat so\'rovi: standartlar, satr -> son, katta pageSize rad', () => {
    expect(AdminUsersQuerySchema.parse({})).toEqual({ q: '', page: 1, pageSize: 20 });
    expect(AdminUsersQuerySchema.parse({ q: '  ali ', page: '3', pageSize: '50' })).toEqual({ q: 'ali', page: 3, pageSize: 50 });
    expect(AdminUsersQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(AdminUsersQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('bulk-delete: 1..100 ta uuid', () => {
    const id = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';
    expect(AdminBulkDeleteInputSchema.safeParse({ ids: [id] }).success).toBe(true);
    expect(AdminBulkDeleteInputSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(AdminBulkDeleteInputSchema.safeParse({ ids: ['x'] }).success).toBe(false);
    expect(AdminBulkDeleteInputSchema.safeParse({ ids: Array(ADMIN_BULK_DELETE_MAX + 1).fill(id) }).success).toBe(false);
  });
});
