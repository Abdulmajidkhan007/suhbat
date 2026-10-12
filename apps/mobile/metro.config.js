const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/**
 * Monorepo (npm workspaces) sozlamasi — qaror `docs/REJA.md` da:
 * - `@suhbat/*` paketlari root `node_modules` da symlink, haqiqiy fayllari
 *   `packages/*` da — ikkalasi ham kuzatiladi (watchFolders).
 * - Paketlar avval ilovaning, keyin root `node_modules` idan qidiriladi.
 * - `react` faqat bitta nusxa bo'lishi shart va RN renderer versiyasiga aynan
 *   mos kelishi kerak (veb boshqa versiyada). Shuning uchun `react` har doim
 *   ilovaning o'z nusxasidan olinadi, kim import qilmasin (hoist qilingan
 *   `react-native` ham).
 */
const PINNED = ['react'];
const pinnedOrigin = path.join(projectRoot, 'package.json');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [path.join(monorepoRoot, 'node_modules'), path.join(monorepoRoot, 'packages')],
  resolver: {
    nodeModulesPaths: [path.join(projectRoot, 'node_modules'), path.join(monorepoRoot, 'node_modules')],
    resolveRequest: (context, moduleName, platform) => {
      const pinned = PINNED.some((p) => moduleName === p || moduleName.startsWith(`${p}/`));
      return context.resolveRequest(
        pinned ? { ...context, originModulePath: pinnedOrigin } : context,
        moduleName,
        platform,
      );
    },
  },
  // API manzili babel orqali bundle'ga qotadi — o'zgarsa kesh yangilansin.
  cacheVersion: `api-url:${process.env.SUHBAT_API_URL ?? ''}`,
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
