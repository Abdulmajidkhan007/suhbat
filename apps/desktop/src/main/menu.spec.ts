import { describe, expect, it } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { buildMenuTemplate } from './menu';

const labels = (items: MenuItemConstructorOptions[]): string[] =>
  items.flatMap((i) => [i.label ?? '', ...(Array.isArray(i.submenu) ? labels(i.submenu) : [])]).filter(Boolean);

const roles = (items: MenuItemConstructorOptions[]): string[] =>
  items.flatMap((i) => [i.role ?? '', ...(Array.isArray(i.submenu) ? roles(i.submenu) : [])]).filter(Boolean);

describe('buildMenuTemplate', () => {
  it('macOS: ilova menyusi + Tahrirlash (Cmd+C/V uchun role\'lar), inglizcha yozuv yo\'q', () => {
    const menu = buildMenuTemplate('darwin', 'suhbat', false);
    expect(menu.map((m) => m.label)).toEqual(['suhbat', 'Tahrirlash', 'Ko\'rinish', 'Oyna']);
    expect(roles(menu)).toEqual(expect.arrayContaining(['copy', 'paste', 'cut', 'selectAll', 'quit']));
    for (const l of labels(menu)) expect(l).not.toMatch(/\b(File|Edit|View|Window|Help|Copy|Paste|Quit)\b/);
  });

  it('Windows: Fayl menyusi; dasturchi vositalari faqat dev rejimda', () => {
    expect(buildMenuTemplate('win32', 'suhbat', false)[0]?.label).toBe('Fayl');
    expect(roles(buildMenuTemplate('win32', 'suhbat', false))).not.toContain('toggleDevTools');
    expect(roles(buildMenuTemplate('win32', 'suhbat', true))).toContain('toggleDevTools');
  });
});
