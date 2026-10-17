# suhbat — egasi qiladigan ishlar

Hammasi **Railway**'da (bitta loyiha): Postgres, API (+ Volume), veb. Tashqi xizmat shart emas.
Texnik tafsilot: [`docs/DEPLOY.md`](docs/DEPLOY.md). Uzun ixtiyoriy yo'riqnomalar:
[`docs/QADAMLAR-TAFSILOT.md`](docs/QADAMLAR-TAFSILOT.md).

> Railway'ning o'zida men sinab ko'ra olmadim (akkauntga kira olmayman) — kod va Docker image'lar
> lokal/CI'da tekshirilgan. Xato chiqsa — oxirgi bo'lim.
> **Kalit, parol, `JWT_SECRET`, `DATABASE_URL` ni hech kimga (menga ham) yubormang** — faqat Railway Variables / GitHub Secrets.

## Majburiy

**1. Railway.** https://railway.com ga GitHub bilan kiring, **Hobby** tarifini yoqing ($5/oy).
**New Project → Deploy from GitHub repo → `suhbat`.** Railway har workspace uchun xizmat yaratishi mumkin —
faqat API va veb qolsin (`desktop`, `mobile` → **Settings → Delete service**).

**2. Postgres.** **+ New → Database → Add PostgreSQL** (nomi `Postgres` qolsin).

**3. API xizmati.** **Settings:** Root Directory — bo'sh; Config file path = `/apps/api/railway.toml`;
Replicas = `1`; Custom Build/Start Command — bo'sh. **Variables:**

| Nomi | Qiymati |
|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `apps/api/Dockerfile` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (aynan shunday) |
| `JWT_SECRET` | `openssl rand -base64 48` natijasi |
| `TRUST_PROXY` | `1` |
| `CORS_ORIGIN` | hozircha `suhbat://app` (5-qadamda veb qo'shiladi) |
| `RAILWAY_RUN_UID` | `0` (4-qadamdagi Volume uchun) |

`PORT` ni qo'ymang. **Networking → Generate Domain** → API manzilini nusxalang.
Tekshiruv: `https://API-MANZIL/health` → `{"status":"ok","db":"up"}`.

**4. Fayllar uchun Volume.** **+ New → Volume** → xizmat **API**, Mount path = `/data`.
Deploy Logs'da `media fayllari: /data/media` chiqishi kerak (busiz yuborilgan fayllar har deploy'da o'chadi).

**5. Veb xizmati.** **+ New → GitHub Repo → `suhbat`**. Settings: Root Directory — bo'sh, Config file path =
`/apps/web/railway.toml`. Variables: `RAILWAY_DOCKERFILE_PATH` = `apps/web/Dockerfile`,
`VITE_API_URL` = API manzili (oxirida `/` siz; o'zgartirsangiz vebni qayta deploy qiling).
**Generate Domain** → so'ng API'da `CORS_ORIGIN` = `https://VEB-MANZIL,suhbat://app` (vergul, probelsiz).

**6. GitHub.** Repo → **Settings → Secrets and variables → Actions → Variables → New repository variable**:
`SUHBAT_API_URL` = API manzili, `https://` bilan, oxirida `/` siz (masalan `https://suhbatapi-production.up.railway.app`).
Bo'lmasa yoki noto'g'ri bo'lsa release ataylab yiqiladi.

**7. Release.** `CHANGELOG.md` da teg nomli bo'lim bo'lsin (masalan `## v0.3.0`). GitHub → **Actions → Release →
Run workflow** → branch `main`, tag `v0.3.0`. 20–40 daqiqada **Releases** sahifasida macOS `dmg`, Windows `exe`,
Android `apk`. Ilovalar imzosiz — macOS/Windows ogohlantiradi (normal).

## Ixtiyoriy

**Bildirishnomalar.** Android — sozlash shart emas: ilovada **Sozlamalar → "Fonda ulanib turish"** → batareya
so'roviga **Ruxsat berish** (Xiaomi/Huawei'da yana **Avtomatik ishga tushish**). Veb/desktop — ilova ochiq
bo'lsa o'zi ishlaydi. **iPhone'da ilova yopiq bo'lsa** bildirishnoma faqat Apple push orqali: Firebase +
Apple Developer ($99/yil) — [tafsilot 2](docs/QADAMLAR-TAFSILOT.md#2-firebase-fcm--ios-push-uchun-yoki-androidda-fon-ulanishisiz).

**Qo'ng'iroqlar uchun TURN** (mobil internet / ofis tarmog'ida ulanish uchun). Railway'da (faqat TCP, Railway'da
hali sinalmagan): **+ New → GitHub Repo → `suhbat`**, nomi `turn`, Config file path = `/infra/turn/railway.toml`,
Variables `TURN_MODE=railway`, `TURN_SECRET=<openssl rand -hex 32>`; **Networking → TCP Proxy → 3478** →
API Variables: `TURN_URLS=turn:<proxy-manzil>:<port>?transport=tcp`, `TURN_SECRET=${{turn.TURN_SECRET}}`.
Sifatliroq — arzon VPS'da bitta buyruq: [`infra/turn/README.md`](infra/turn/README.md).

**Parolni tiklash xati.** ⚠️ Railway **Hobby**'da chiquvchi SMTP yopiq (faqat Pro+; Railway xodimlari javobi,
rasmiy sahifani tekshira olmadim). Hobby'da — **Resend**: https://resend.com → API Keys → API Variables
`RESEND_API_KEY=re_...`, `MAIL_FROM=Suhbat <onboarding@resend.dev>` (sinovda xat faqat o'zingizga; boshqalarga —
Resend'da domen tasdiqlang), `WEB_URL=<veb manzili>`. Pro'da — **Gmail SMTP**: App Password
(https://myaccount.google.com/apppasswords) → `SMTP_URL=smtps://email%40gmail.com:APPPAROL@smtp.gmail.com:465`,
`MAIL_FROM=Suhbat <email@gmail.com>`, `WEB_URL`. Logda `SMTP serverga ulanib bo'lmadi` — port yopiq, Resend'ga o'ting.

**Android doimiy imzo kaliti** (busiz har release'da eski APK'ni o'chirib qayta o'rnatish kerak):
[tafsilot 1 — Termux bilan telefonda](docs/QADAMLAR-TAFSILOT.md#1-android-imzosi--telefonda-termux-bilan).

## Muammo bo'lsa

Yuboring: qaysi xizmat (API / veb / turn) va qaysi qadam; Railway → xizmat → **Deployments → Build Logs** va
**Deploy Logs** matni (oxirgi ~50 qator, ekran rasmi emas); brauzerda bo'lsa **F12 → Console** dagi qizil xato.
Logda kalit/parol ko'rinib qolsa — o'chirib yuboring.
