/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** `apps/web/package.json` versiyasi (vite `define`). */
declare const __APP_VERSION__: string;
