# O'zgarishlar

Release matni shu fayldan olinadi (`release.yml`: `## vX.Y.Z` bo'limi).

## v0.1.1

- **"Tarmoq xatosi" tuzatildi (ro'yxatdan o'tish/kirish).** Sabab: `SUHBAT_API_URL` `https://` siz
  berilgan edi va ilova so'rovni noto'g'ri (nisbiy) manzilga yuborardi. Endi:
  - ilovalar (veb, desktop, Android, iOS) sxemasiz manzilga o'zi `https://` qo'shadi;
  - release build bo'sh yoki `https://` siz `SUHBAT_API_URL` bilan aniq xato berib to'xtaydi
    (Android uchun faqat `https://` — release APK'da shifrlanmagan HTTP o'chiq).
- **Ilova ikonkasi:** Android'dagi standart yashil robot o'rniga Suhbat ikonkasi (ko'k gradient, oq nutq
  pufagi va "S"). Android (adaptive icon, Android 12+ ishga tushish ekrani brend rangida), iOS, macOS,
  Windows va veb (favicon, PWA manifest).
- **Push bildirishnomalar release APK'da:** `GOOGLE_SERVICES_JSON` secret'i bo'lsa APK push bilan quriladi,
  bo'lmasa push'siz (Actions logida ogohlantirish).
- Android imzolash kalitini telefonda (Termux) yaratish yo'riqnomasi — `QADAMLAR.md` 9.

## v0.1.0

- Birinchi release: veb, desktop (macOS, Windows, imzosiz), Android APK.
