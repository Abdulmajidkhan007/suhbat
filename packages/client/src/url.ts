const SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * API manzilini bitta ko'rinishga keltiradi: bo'sh joylar va oxiridagi `/` olib tashlanadi,
 * sxemasiz host (`api.suhbat.uz`) berilsa `https://` qo'shiladi. Aks holda `fetch`
 * manzilni nisbiy yo'l deb tushunadi va so'rov noto'g'ri joyga ketadi ("Tarmoq xatosi").
 */
export const normalizeApiUrl = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed === '' || SCHEME.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
};
