const path = require('node:path');

// `react` — ilovaning o'z nusxasi (RN renderer bilan aynan bir versiya), qarang metro.config.js.
const reactDir = path.dirname(require.resolve('react/package.json', { paths: [__dirname] }));

/** @type {import('jest').Config} */
module.exports = {
  preset: '@react-native/jest-preset',
  roots: ['<rootDir>/src'],
  // CI'da turbo boshqa vazifalar bilan parallel ishlaydi — birinchi render (RN transform) sekin.
  testTimeout: 30_000,
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup-after-env.js'],
  moduleNameMapper: {
    '^react$': reactDir,
    '^react/(.*)$': `${reactDir}/$1`,
  },
  // @suhbat/* paketlari ESM (dist) — babel orqali o'tkaziladi.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@suhbat|react-native-keychain|react-native-safe-area-context)/)',
  ],
};
