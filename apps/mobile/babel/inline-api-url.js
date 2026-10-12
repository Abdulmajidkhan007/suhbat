/**
 * `process.env.SUHBAT_API_URL` ni build vaqtida satrga almashtiradi
 * (react-native-config kabi native modulsiz). O'rnatilmagan bo'lsa `undefined`.
 * Faqat shu bitta o'zgaruvchi — boshqa env bundle'ga tushmaydi.
 */
module.exports = ({ types: t }) => ({
  name: 'suhbat-inline-api-url',
  visitor: {
    MemberExpression(p) {
      if (!p.matchesPattern('process.env.SUHBAT_API_URL')) return;
      const value = process.env.SUHBAT_API_URL;
      p.replaceWith(value ? t.stringLiteral(value) : t.identifier('undefined'));
    },
  },
});
