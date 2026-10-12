module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // zod 4 (`export * as core from ...`) — RN preset buni o'zgartirmaydi.
    '@babel/plugin-transform-export-namespace-from',
    './babel/inline-api-url',
  ],
};
