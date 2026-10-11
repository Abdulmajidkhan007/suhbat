import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS dekoratorlari (emitDecoratorMetadata) uchun esbuild emas, SWC kerak.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  },
});
