import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS dekoratorlari (emitDecoratorMetadata) uchun esbuild emas, SWC kerak.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    // e2e'lar tez ishlashi uchun rate limit amalda o'chirilgan; cheklov testlari o'z qiymatlarini beradi.
    env: { THROTTLE_LIMIT: '100000', THROTTLE_AUTH_LIMIT: '100000', WS_SEND_LIMIT: '100000' },
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  },
});
