import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAppFile } from './app-protocol';

const root = path.resolve('/srv/web');

describe('resolveAppFile', () => {
  it('fayl va ildiz', () => {
    expect(resolveAppFile(root, 'suhbat://app/assets/index-abc.js')).toBe(path.join(root, 'assets/index-abc.js'));
    expect(resolveAppFile(root, 'suhbat://app/')).toBe(path.join(root, 'index.html'));
    expect(resolveAppFile(root, 'suhbat://app')).toBe(path.join(root, 'index.html'));
  });

  it('SPA marshruti (kengaytmasiz) → index.html', () => {
    expect(resolveAppFile(root, 'suhbat://app/chats/123')).toBe(path.join(root, 'index.html'));
  });

  it('ildizdan chiqish va begona origin rad etiladi', () => {
    // URL tahlilchisi `..` ni o'zi normallashtiradi — baribir ildiz ichida qoladi
    expect(resolveAppFile(root, 'suhbat://app/../secret.txt')).toBe(path.join(root, 'secret.txt'));
    expect(resolveAppFile(root, 'suhbat://app/%2e%2e/secret.txt')).toBe(path.join(root, 'secret.txt')); // %2e ham normallashadi
    expect(resolveAppFile(root, 'suhbat://app/..%2f..%2fetc/passwd')).toBeNull();
    expect(resolveAppFile(root, 'suhbat://evil/index.html')).toBeNull();
    expect(resolveAppFile(root, 'https://app/index.html')).toBeNull();
    expect(resolveAppFile(root, 'not a url')).toBeNull();
    expect(resolveAppFile(root, 'suhbat://app/a%00.js')).toBeNull();
  });
});
