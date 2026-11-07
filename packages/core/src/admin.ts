import { z } from 'zod';

// Admin panel API kontrakti (`/admin/*`). Parol, hash va tiklash kodlari bu yerda HECH QACHON uchramaydi
// (vaqtincha parol va yangi kodlar bundan mustasno — ular faqat yaratilgan javobda, bir marta qaytadi).
const isoDate = z.iso.datetime({ offset: true });

export const ADMIN_PAGE_SIZE_DEFAULT = 20;
export const ADMIN_PAGE_SIZE_MAX = 100;
/** Bir so'rovda ko'pi bilan nechta foydalanuvchi o'chiriladi. */
export const ADMIN_BULK_DELETE_MAX = 100;

export const AdminUsersQuerySchema = z.object({
  /** username / email / ism bo'yicha qism qidiruv (katta-kichik harf farqsiz). */
  q:        z.string().trim().max(64).default(''),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(ADMIN_PAGE_SIZE_MAX).default(ADMIN_PAGE_SIZE_DEFAULT),
});
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;

export const AdminUserSchema = z.object({
  id:                 z.uuid(),
  username:           z.string().nullable(),
  displayName:        z.string(),
  email:              z.string(),
  createdAt:          isoDate,
  /** Oxirgi WebSocket uzilgan vaqt; hech qachon ulanmagan bo'lsa `null`. */
  lastSeenAt:         isoDate.nullable(),
  /** Ishlatilmagan tiklash kodi bormi. */
  hasRecoveryCodes:   z.boolean(),
  /** Faol (bekor qilinmagan, muddati o'tmagan) sessiyalar — qurilmalar soni. */
  activeSessions:     z.number().int().min(0),
  blocked:            z.boolean(),
  /** Vaqtinchalik parol berilgan, hali almashtirilmagan. */
  mustChangePassword: z.boolean(),
  /** Email `ADMIN_EMAILS` da — shu foydalanuvchi o'zi admin. */
  isAdmin:            z.boolean(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminUserListSchema = z.object({
  items:    z.array(AdminUserSchema),
  total:    z.number().int().min(0),
  page:     z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type AdminUserList = z.infer<typeof AdminUserListSchema>;

export const AdminTempPasswordResponseSchema = z.object({
  /** Faqat shu javobda, bir marta. */
  temporaryPassword: z.string(),
});
export type AdminTempPasswordResponse = z.infer<typeof AdminTempPasswordResponseSchema>;

export const AdminRecoveryCodesResponseSchema = z.object({
  codes: z.array(z.string()),
});
export type AdminRecoveryCodesResponse = z.infer<typeof AdminRecoveryCodesResponseSchema>;

export const AdminBulkDeleteInputSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(ADMIN_BULK_DELETE_MAX),
});
export type AdminBulkDeleteInput = z.infer<typeof AdminBulkDeleteInputSchema>;

export const AdminBulkDeleteResultSchema = z.object({
  deleted:  z.array(z.uuid()),
  /** Bazada topilmaganlar (allaqachon o'chgan). */
  notFound: z.array(z.uuid()),
});
export type AdminBulkDeleteResult = z.infer<typeof AdminBulkDeleteResultSchema>;

export const AdminAuditActionSchema = z.enum([
  'user.block',
  'user.unblock',
  'user.revoke_sessions',
  'user.temp_password',
  'user.recovery_codes',
  'user.delete',
]);
export type AdminAuditAction = z.infer<typeof AdminAuditActionSchema>;

export const AdminAuditQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(ADMIN_PAGE_SIZE_MAX).default(ADMIN_PAGE_SIZE_DEFAULT),
});
export type AdminAuditQuery = z.infer<typeof AdminAuditQuerySchema>;

export const AdminAuditEntrySchema = z.object({
  id:           z.uuid(),
  /** Kim: amalni bajargan admin (o'chirilgan bo'lsa ham email saqlanadi). */
  adminId:      z.uuid(),
  adminEmail:   z.string(),
  action:       AdminAuditActionSchema,
  /** Kimga: foydalanuvchi o'chirilgan bo'lsa ham id va yorliq (username/email) qoladi. */
  targetUserId: z.uuid(),
  targetLabel:  z.string(),
  createdAt:    isoDate,
});
export type AdminAuditEntry = z.infer<typeof AdminAuditEntrySchema>;

export const AdminAuditListSchema = z.object({
  items:    z.array(AdminAuditEntrySchema),
  total:    z.number().int().min(0),
  page:     z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type AdminAuditList = z.infer<typeof AdminAuditListSchema>;
