// Admin amallari: matnlar va bajaruvchi (`api.admin`). UI faqat shu jadvalga tayanadi.
import type { AdminUser } from '@suhbat/core';
import { api } from '../../services/api';

export type AdminActionKind = 'block' | 'unblock' | 'revoke' | 'tempPassword' | 'recoveryCodes' | 'delete';

export interface ActionSpec {
  label:        string;
  title:        (u: AdminUser) => string;
  description:  string;
  confirmLabel: string;
  destructive:  boolean;
  /** `true` — o'z hisobiga qo'llab bo'lmaydi (server ham rad etadi). */
  notSelf:      boolean;
}

export const who = (u: AdminUser) => u.username ? `@${u.username}` : u.email;

export const ACTIONS: Record<AdminActionKind, ActionSpec> = {
  block: {
    label: 'Bloklash', title: (u) => `${who(u)} bloklansinmi?`, confirmLabel: 'Bloklash', destructive: true, notSelf: true,
    description: 'Foydalanuvchi kira olmaydi, barcha qurilmalardagi sessiyalari yopiladi va ulanishi uziladi. Keyin blokdan chiqarish mumkin.',
  },
  unblock: {
    label: 'Blokdan chiqarish', title: (u) => `${who(u)} blokdan chiqarilsinmi?`, confirmLabel: 'Blokdan chiqarish', destructive: false, notSelf: false,
    description: 'Foydalanuvchi o\'z paroli bilan yana kira oladi.',
  },
  revoke: {
    label: 'Sessiyalarni yopish', title: (u) => `${who(u)} sessiyalari yopilsinmi?`, confirmLabel: 'Yopish', destructive: true, notSelf: false,
    description: 'Barcha qurilmalarda qayta kirish talab qilinadi. Parol o\'zgarmaydi.',
  },
  tempPassword: {
    label: 'Vaqtinchalik parol', title: (u) => `${who(u)} uchun vaqtinchalik parol yaratilsinmi?`, confirmLabel: 'Yaratish', destructive: true, notSelf: true,
    description: 'Eski parol ishlamay qoladi, barcha sessiyalar yopiladi. Yangi parol bir marta ko\'rsatiladi; foydalanuvchi kirgach yangi parol o\'rnatishi shart.',
  },
  recoveryCodes: {
    label: 'Yangi tiklash kodlari', title: (u) => `${who(u)} uchun yangi tiklash kodlari yaratilsinmi?`, confirmLabel: 'Yaratish', destructive: true, notSelf: false,
    description: 'Eski kodlar bekor bo\'ladi. Yangi 10 ta kod bir marta ko\'rsatiladi.',
  },
  delete: {
    label: 'O\'chirish', title: (u) => `${who(u)} o'chirilsinmi?`, confirmLabel: 'O\'chirish', destructive: true, notSelf: true,
    description: 'Hisob, uning xabarlari, 1:1 chatlari va fayllari o\'chadi. Bu amalni qaytarib bo\'lmaydi.',
  },
};

/** Natijasi bir marta ko'rsatiladigan amallar — `values`, qolganlari `null`. */
export const runAction = async (kind: AdminActionKind, id: string): Promise<string[] | null> => {
  switch (kind) {
    case 'block':         await api.admin.block(id); return null;
    case 'unblock':       await api.admin.unblock(id); return null;
    case 'revoke':        await api.admin.revokeSessions(id); return null;
    case 'delete':        await api.admin.deleteUser(id); return null;
    case 'tempPassword':  return [await api.admin.tempPassword(id)];
    case 'recoveryCodes': return api.admin.recoveryCodes(id);
  }
};
