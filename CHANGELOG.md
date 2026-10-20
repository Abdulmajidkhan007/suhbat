# O'zgarishlar

Release matni shu fayldan olinadi (`release.yml`: `## vX.Y.Z` bo'limi).

## v0.5.0 (chiqarilmagan)

- **Parolni email'siz tiklash — tiklash kodlari** (veb, desktop, mobil): ro'yxatdan o'tgach 10 ta bir martalik kod
  bir marta ko'rsatiladi (nusxa olish, `.txt` yuklab olish / ulashish, "saqladim" tasdig'i). Parolni unutsangiz:
  **Kirish → Parolni unutdim? → Tiklash kodi bilan** — login, kod va yangi parol. Email sozlanmagan bo'lsa ham ishlaydi.
  Har bir kod bir marta ishlaydi; tiklangach barcha qurilmalardan chiqiladi.
- **Sozlamalar → Xavfsizlik:** qolgan kodlar soni, joriy parol bilan yangi kodlar yaratish (eskilari bekor bo'ladi),
  **parolni o'zgartirish** (boshqa qurilmalardan chiqiladi). Avval ro'yxatdan o'tgan foydalanuvchilarga kod yaratish taklifi.
- Email orqali tiklash ixtiyoriy bo'lib qoladi (sozlangan bo'lsa ishlaydi).
- Haqiqiy telefonda va desktop ilovada (nusxa olish, `.txt` saqlash, ulashish) hali sinalmagan.

## v0.4.0 (chiqarilmagan)

Tashqi xizmatlarga (Cloudflare R2, metered.ca, Firebase, Resend) bog'liqlik kamaytirildi — asosiy yo'l o'zimizda (Railway).
Hammasi lokal/CI'da tekshirilgan; **Railway'ning o'zida va haqiqiy telefonda hali sinalmagan.**

- **Rasm, fayl va ovozli xabarlar endi o'z serverimizda** (Railway Volume). Yuklab olish havolasi faqat chat
  a'zosiga va qisqa muddatga beriladi. Cloudflare R2 / boshqa S3 ixtiyoriy qoladi. Volume'siz fayllar har deploy'da
  o'chadi — `QADAMLAR.md` 4-qadam.
- **Qo'ng'iroqlar uchun o'z TURN serverimiz** (coturn, `infra/turn/`): Railway'da (faqat TCP — Railway UDP bermaydi)
  yoki arzon VPS'da bitta buyruq bilan. Mexanizm lokal va CI'da sinalgan; Railway'da va haqiqiy qo'ng'iroqda —
  hali yo'q, TCP ustida ovoz/videoda kechikish bo'lishi mumkin.
- **Android: Google xizmatlarisiz bildirishnomalar.** Sozlamalar → "Fonda ulanib turish": ilova yopiq bo'lsa ham
  yangi xabar va kiruvchi qo'ng'iroq bildirishnomasi (doimiy "Suhbat ulangan" yozuvi bilan), bosilsa chat ochiladi,
  batareya optimizatsiyasidan chiqarish so'raladi. Haqiqiy telefonda (ayniqsa Xiaomi/Huawei) hali sinalmagan.
- **Veb va desktop: tizim bildirishnomalari** — ilova boshqa oyna/tab'da bo'lsa yangi xabar va qo'ng'iroq haqida
  (oldin yo'q edi). Tab yopiq bo'lsa — yo'q.
- **iPhone:** ilova yopiq bo'lsa bildirishnoma faqat Apple push (Firebase + Apple Developer) orqali — o'zgarmadi.
- **Parolni tiklash xati:** SMTP (masalan Gmail) yoki Resend. Railway **Hobby** tarifida chiquvchi SMTP yopiq —
  u yerda Resend kerak. SMTP ulanmasa endi 10 soniyada aniq xato (avval 2 daqiqa kutardi).
- `QADAMLAR.md` qisqartirildi: majburiy va ixtiyoriy qadamlar alohida.

## v0.3.0 (chiqarilmagan)

- **"Parolni unutdim?"** (veb, desktop, mobil): email yoki username kiriting → emailga havola keladi
  (30 daqiqa, bir martalik) → vebda yangi parol o'rnatiladi. Parol o'zgargach barcha qurilmalardan chiqiladi.
  Xat yuborish uchun server sozlanishi kerak (Resend yoki SMTP — `QADAMLAR.md`, "Parolni tiklash xati"); sozlanmagan bo'lsa
  "Email yuborish hozircha sozlanmagan" chiqadi.
- **Username:** `@username` (ixtiyoriy) — ro'yxatdan o'tishda yoki profilda; band/bo'shligi darhol ko'rinadi.
  Kirish endi **email yoki username** bilan; qidiruvda `@username` bo'yicha aniq topiladi.
- **Xabarga javob berish** (veb, desktop, mobil): xabar menyusidan "Javob berish"; javobda asl xabar ko'rinadi, bosilsa
  unga o'tadi; asl xabar o'chirilsa — "O'chirilgan xabar". Faqat shu suhbatdagi xabarga javob berish mumkin.
- **Mobil ilova — yangi dizayn:** yorug'/qorong'i/tizim rejimi va 7 ta asosiy rang; pastki tablar (Suhbatlar, Sozlamalar);
  chat ro'yxati (vaqt, ✓/✓✓, "Siz:", o'qilmaganlar, "yozmoqda"); chatda sana ajratgichlari, uzun bosish menyusi
  (nusxa olish, tahrirlash, o'chirish); guruh/kanal ma'lumoti (a'zolar, rollar, qo'shish/chiqarish); yangi guruh/kanal;
  sozlamalar (bildirishnoma matni, ko'rinish); "Ulanmoqda…" holati. Haqiqiy telefonda hali sinalmagan.
- **Veb va desktop tuzatishlari (audit):** "Internet yo'q" / "Ulanmoqda…" yorlig'i; yuborilmagan xabarni qayta
  yuborish yoki o'chirish; havolalar bosiladigan; xabar matnidan nusxa olish; bo'sh chatda yozish maydoni pastda;
  1:1 chatda har xabar ustida ism takrorlanmaydi; qorong'i rejim tizim sozlamasiga ergashadi; "Chiqish" tasdiq bilan;
  xato xabarlari o'zbekcha; desktop menyusi o'zbekcha, oyna sarlavhasi "Suhbat".
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
