import type { MenuItemConstructorOptions } from 'electron';

/**
 * Ilova menyusi — o'zbekcha (Electron standart menyusi inglizcha: File, Edit, View…).
 * `role` lar tizim amallarini (nusxa, qo'yish, chiqish) va ularning tugmalar birikmasini beradi;
 * macOS'da "Tahrirlash" menyusisiz Cmd+C / Cmd+V ishlamaydi.
 */
export const buildMenuTemplate = (platform: NodeJS.Platform, appName: string, isDev: boolean): MenuItemConstructorOptions[] => {
  const mac = platform === 'darwin';
  const appMenu: MenuItemConstructorOptions = {
    label: appName,
    submenu: [
      { role: 'about', label: `${appName} haqida` },
      { type: 'separator' },
      { role: 'hide', label: `${appName} ni yashirish` },
      { role: 'hideOthers', label: 'Boshqalarni yashirish' },
      { role: 'unhide', label: 'Hammasini ko\'rsatish' },
      { type: 'separator' },
      { role: 'quit', label: `${appName} dan chiqish` },
    ],
  };
  const edit: MenuItemConstructorOptions = {
    label: 'Tahrirlash',
    submenu: [
      { role: 'undo', label: 'Bekor qilish' },
      { role: 'redo', label: 'Qaytarish' },
      { type: 'separator' },
      { role: 'cut', label: 'Kesish' },
      { role: 'copy', label: 'Nusxa olish' },
      { role: 'paste', label: 'Qo\'yish' },
      { role: 'selectAll', label: 'Hammasini belgilash' },
    ],
  };
  const view: MenuItemConstructorOptions = {
    label: 'Ko\'rinish',
    submenu: [
      { role: 'reload', label: 'Qayta yuklash' },
      ...(isDev ? [{ role: 'toggleDevTools', label: 'Dasturchi vositalari' } as const] : []),
      { type: 'separator' },
      { role: 'resetZoom', label: 'Asl o\'lcham' },
      { role: 'zoomIn', label: 'Kattalashtirish' },
      { role: 'zoomOut', label: 'Kichiklashtirish' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'To\'liq ekran' },
    ],
  };
  const windowMenu: MenuItemConstructorOptions = {
    label: 'Oyna',
    submenu: mac
      ? [{ role: 'minimize', label: 'Yig\'ish' }, { role: 'zoom', label: 'Kattalashtirish' }, { type: 'separator' }, { role: 'front', label: 'Hammasini oldinga' }]
      : [{ role: 'minimize', label: 'Yig\'ish' }, { role: 'close', label: 'Yopish' }],
  };
  return mac ? [appMenu, edit, view, windowMenu] : [{ label: 'Fayl', submenu: [{ role: 'quit', label: 'Chiqish' }] }, edit, view, windowMenu];
};
