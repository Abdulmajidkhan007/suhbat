import { afterEach, describe, expect, it, vi } from 'vitest';

const mockSystem = (dark: boolean) =>
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() })));

describe('themeSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.resetModules();
  });

  it('tanlov yo\'q — tizim rejimi (qorong\'i), tizim o\'zgarsa ergashadi; tanlangach ergashmaydi', async () => {
    mockSystem(true);
    const { default: reducer, systemThemeChanged, setTheme } = await import('./themeSlice');
    let state = reducer(undefined, { type: 'init' });
    expect(state).toEqual({ mode: 'dark', follow: true });
    state = reducer(state, systemThemeChanged('light'));
    expect(state.mode).toBe('light');
    state = reducer(state, setTheme('dark'));
    state = reducer(state, systemThemeChanged('light'));
    expect(state.mode).toBe('dark');
    expect(localStorage.getItem('themeMode')).toBe('dark');
  });

  it('saqlangan tanlov tizimdan ustun; yaroqsiz qiymat e\'tiborsiz', async () => {
    mockSystem(true);
    localStorage.setItem('themeMode', 'light');
    const first = await import('./themeSlice');
    expect(first.default(undefined, { type: 'init' })).toEqual({ mode: 'light', follow: false });

    vi.resetModules();
    localStorage.setItem('themeMode', 'binafsha');
    const second = await import('./themeSlice');
    expect(second.default(undefined, { type: 'init' }).mode).toBe('dark');
  });
});
