<p align="center">
  <img src="assets/brand/icon.svg" width="96" height="96" alt="Suhbat logotipi" />
</p>

<h1 align="center">Suhbat</h1>

<p align="center">
  O'zbek tilidagi messenjer — veb, kompyuter (macOS, Windows), Android va iOS uchun.<br />
  Shaxsiy yozishmalar, guruhlar, kanallar va qo'ng'iroqlar — bitta hisobda, barcha qurilmalarda.
</p>

<p align="center">
  <a href="https://suhbatweb-production.up.railway.app"><b>Vebda ochish</b></a> ·
  <a href="https://github.com/Abdulmajidkhan007/suhbat/releases/latest"><b>Yuklab olish</b></a> ·
  <a href="CHANGELOG.md">O'zgarishlar</a>
</p>

> **Holat: beta.** Ilova faol ishlab chiqilmoqda — ayrim imkoniyatlar to'liq emas, xatolar bo'lishi mumkin.

## Imkoniyatlar

- 💬 **Shaxsiy chat** — real vaqtda xabarlar, "yozmoqda…", onlayn holati va "oxirgi marta", ✓ yuborildi / ✓✓ o'qildi.
- ↩️ **Javob berish, tahrirlash, o'chirish** — xabarga javob (asl xabarga bir bosishda o'tish), matnni tahrirlash, nusxa olish.
- 👥 **Guruhlar** — 200 tagacha a'zo, ega va adminlar, a'zo qo'shish/chiqarish.
- 📢 **Kanallar** — ochiq va yopiq kanallar, faqat adminlar yozadi, obunachilar soni.
- 📞 **Qo'ng'iroqlar** — 1:1 ovozli va video qo'ng'iroq (WebRTC).
- 🔎 **Global qidiruv** — suhbatlar, odamlar (ism, `@username`) va ochiq kanallar bitta joyda.
- 🖼 **Fayllar** — rasm, hujjat va ovozli xabarlar (yuborish — veb va desktop'da).
- 🔔 **Bildirishnomalar** — mobil ilovada push; xabar matnini yashirish mumkin.
- 👤 **Profil** — ism, `@username`, "Men haqimda"; email yoki username bilan kirish, parolni tiklash.
- 🌗 **Ko'rinish** — yorug' va qorong'i rejim, mobil ilovada asosiy rangni tanlash.
- 🇺🇿 **To'liq o'zbekcha** interfeys, 24 soatlik vaqt.

## Platformalar

| Platforma | Qanday olish |
|-----------|--------------|
| Veb (brauzer, telefon brauzeri ham) | [suhbatweb-production.up.railway.app](https://suhbatweb-production.up.railway.app) |
| macOS (`.dmg`), Windows (`.exe`) | [Releases](https://github.com/Abdulmajidkhan007/suhbat/releases/latest) — ilovalar hozircha imzosiz, birinchi ochishda tizim ogohlantiradi |
| Android (`.apk`) | [Releases](https://github.com/Abdulmajidkhan007/suhbat/releases/latest) |
| iOS | hozircha faqat manbadan build qilinadi ([DEVELOPMENT.md](docs/DEVELOPMENT.md)) |

## Texnologiyalar

- **Server:** NestJS, PostgreSQL (Prisma), Socket.IO, S3-mos fayl saqlash, FCM push.
- **Veb va desktop:** React, TypeScript, Vite, MUI, Tailwind CSS, Redux Toolkit; desktop — Electron.
- **Mobil:** React Native (bare CLI, Expo'siz), TypeScript.
- **Umumiy:** npm workspaces + Turborepo monorepo, zod sxemalar, WebRTC.

## Hujjatlar

| Fayl | Mazmuni |
|------|---------|
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Tuzilish, lokal ishga tushirish, tekshiruvlar, env, desktop va mobil build |
| [docs/API.md](docs/API.md) | REST va WebSocket kontrakti, qo'ng'iroq signallari |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Joylash (Railway, media saqlash), release va imzolash |
| [QADAMLAR.md](QADAMLAR.md) | Egasi uchun qadam-baqadam sozlash yo'riqnomasi |
| [docs/REJA.md](docs/REJA.md) | Reja, holat, nima tekshirilgan va ma'lum cheklovlar |
| [CHANGELOG.md](CHANGELOG.md) | Versiyalar bo'yicha o'zgarishlar |

## Hissa qo'shish

Xato topsangiz yoki taklifingiz bo'lsa — [Issue](https://github.com/Abdulmajidkhan007/suhbat/issues) oching.
Pull request'lar `main` ga ochiladi; o'zgarishdan oldin `npx turbo run lint typecheck test` yashil bo'lsin
([DEVELOPMENT.md](docs/DEVELOPMENT.md#tekshiruvlar)). Kalit, token va `.env` fayllar repoga qo'shilmaydi.

## Litsenziya

Litsenziya hali tanlanmagan: kod ochiq ko'rish uchun, lekin undan foydalanish, nusxalash va tarqatish huquqlari
muallifda qoladi.
