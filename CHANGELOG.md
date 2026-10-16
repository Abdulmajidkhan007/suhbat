# O'zgarishlar

Release matni shu fayldan olinadi (`release.yml`: `## vX.Y.Z` bo'limi).

## v0.3.0 (chiqarilmagan)

- Desktop fayl nomi va ilovadagi versiya endi release tegidan olinadi (v0.2.0 da desktop fayllari
  `suhbat-0.1.0-…` deb chiqqan edi). Release matni shu fayldan olinadi; tegning bo'limi bo'lmasa release yiqiladi.

## v0.2.0 (2026-10-14)

- **Qo'ng'iroqlar (1:1, WebRTC):** ovozli va video qo'ng'iroq — veb, desktop va mobil. Kiruvchi qo'ng'iroq
  oynasi (qabul/rad), mikrofon/kamera o'chirish, taymer; tugaganda chatda "📞 Qo'ng'iroq, 3:12" yozuvi.
  Ilova yopiq bo'lsa push bildirishnoma. TURN server hali sozlanmagan — ba'zi tarmoqlarda (NAT) ulanmasligi mumkin;
  haqiqiy telefonda sinalmagan.
- **Global qidiruv** (veb, desktop, mobil): "Qidirish" — suhbatlar, foydalanuvchilar va ochiq kanallar bo'limlari;
  foydalanuvchini bossangiz suhbat ochiladi, kanalni bossangiz "Obuna bo'lish".
- **Profil tahriri:** ism va "Men haqimda" (`PATCH /users/me`). Avatar keyinroq.
- Kanal ma'lumotida "Ega va adminlar" ro'yxatida endi faqat ega/adminlar; obunachilar soni alohida.
- **O'zbekcha UI:** veb to'liq o'zbekchalashtirildi; vaqt 24 soatlik ("14:20"); sozlamalardan texnologiya yozuvi olib tashlandi.
- Telefon brauzerida ro'yxat to'liq kenglikda, chat ochilganda yashirinadi ("Orqaga" tugmasi bilan).
- Kanalga obunachi qo'shishda tanlangan odam aniq belgilanadi.

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
