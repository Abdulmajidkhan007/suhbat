# suhbat — joylash (deploy) qo'llanmasi

> Egasi uchun, qadamma-qadam. Kod tayyor; **Railway'da, R2/Netlify'da va GitHub'da
> bosiladigan qadamlarni siz bajarasiz**. Ularni men (Claude) sinab ko'ra olmadim —
> pastdagi "Nima sinalgan" bo'limiga qarang.

## Umumiy rasm

```
 brauzer ──► Netlify (veb, statik)  ──┐
 desktop / telefon ───────────────────┼──► Railway: API  ──► Railway: Postgres
                                      │         │
                                      └─────────┴──► Cloudflare R2 (rasm, fayl, ovoz)
```

| Qism | Qayerda | Nega |
|---|---|---|
| API (NestJS + WebSocket) | **Railway** (Docker) | Egasi qarori. WebSocket qo'llanadi. |
| Baza | **Railway Postgres** | Shu loyihada, ichki tarmoq orqali. |
| Media (fayllar) | **Cloudflare R2** (yoki Railway Buckets, 3-qadamga qarang) | S3-mos; kod `S3_*` env bilan ishlaydi; R2'da 10 GB bepul va chiqish (egress) puli yo'q. |
| Veb | **Netlify** (hozirgi sozlama) | Statik sayt uchun bepul, CDN bor, `apps/web/netlify.toml` tayyor. Railway'da statik sayt uchun alohida konteyner (Caddy/nginx) kerak bo'lardi — ortiqcha xarajat va ish. |
| Desktop, Android | **GitHub Release** | `v*` tegida avtomatik build. |

> API **bitta nusxa**da ishlashi kerak (Replicas = 1): "onlayn" holati va rate limit
> hozircha xotirada. Ko'p nusxa uchun keyinroq Redis kerak.

## 1. Railway: loyiha, Postgres, API

1. https://railway.com ga GitHub bilan kiring. **Hobby** tarifini yoqing (karta kerak).
2. **New Project → Deploy from GitHub repo →** `suhbat` repozitoriyasini tanlang
   (Railway GitHub'ga ruxsat so'raydi). Bu API xizmatini yaratadi.
3. Xizmat **Settings** bo'limida:
   - **Root Directory** — *bo'sh qoldiring* (Docker butun monorepoga muhtoj).
   - **Config-as-code → Config file path** = `/apps/api/railway.toml`
     (Dockerfile yo'li, `/health` tekshiruvi va "faqat API o'zgarsa qayta deploy" shu faylda).
   - **Deploy → Replicas** = 1.
4. Loyihada **+ New → Database → PostgreSQL** qo'shing.
5. API xizmati → **Variables** (yuqoridagi Postgres xizmati nomi `Postgres` bo'lsa):

| O'zgaruvchi | Qiymat |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference — qo'lda ko'chirmang) |
| `JWT_SECRET` | uzun tasodifiy qator: terminalda `openssl rand -base64 48` |
| `CORS_ORIGIN` | `https://VEB-DOMENINGIZ,suhbat://app` (vergul bilan, probelsiz; `suhbat://app` — desktop ilova) |
| `TRUST_PROXY` | `1` (Railway proksisi ortida haqiqiy IP; busiz rate limit hammani bitta mijoz deb sanaydi) |
| `S3_*` | 3-qadamga qarang |

`PORT` ni **qo'ymang** — Railway o'zi beradi, API uni o'qiydi.

6. **Settings → Networking → Generate Domain** — API uchun ochiq manzil beradi
   (`https://....up.railway.app`). O'z domeningiz bo'lsa **Custom Domain** (masalan
   `api.suhbat.uz`) va ko'rsatilgan DNS yozuvini domen provayderingizda qo'shing.
7. Deploy tugagach tekshiring: brauzerda `https://API-MANZIL/health` →
   `{"status":"ok","db":"up"}` chiqishi kerak. Migratsiyalar har ishga tushishda
   avtomatik qo'llanadi (Deploy logs'da `have been applied`).

## 2. Veb (Netlify)

1. https://netlify.com → **Add new site → Import from Git** → shu repo.
2. **Base directory** = `apps/web` (build buyrug'i va `publish` `netlify.toml` dan olinadi).
3. **Environment variables:** `VITE_API_URL` = API manzili (1.6 dagi, oxirida `/`siz).
   *Bu build vaqtida qotadi* — o'zgartirsangiz saytni qayta build qiling.
4. Sayt domeni (`https://....netlify.app` yoki o'zingizniki) ni Railway'dagi `CORS_ORIGIN` ga
   qo'shing va API xizmatini qayta deploy qiling.

## 3. Media saqlash (S3-mos)

Saqlash sozlanmasa ham API ishga tushadi (logda ogohlantirish); faqat fayl yuborish
ishlamaydi — ilova "Fayl saqlash hozir mavjud emas" (503) xatosini oladi.

**Variant A — Cloudflare R2 (tavsiya, aniq ishlaydi):**
1. cloudflare.com → **R2** → bucket yarating (masalan `suhbat-media`).
2. **Manage R2 API Tokens → Create** (Object Read & Write, shu bucket uchun) → *Access Key ID* va *Secret* ni oling.
3. Bucket → **Settings → CORS policy**: brauzer to'g'ridan-to'g'ri `PUT` qiladi, shuning uchun ruxsat bering:
   ```json
   [{"AllowedOrigins": ["https://VEB-DOMENINGIZ", "suhbat://app"],
     "AllowedMethods": ["GET", "PUT", "HEAD"],
     "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600}]
   ```
4. Railway API `Variables`:

| O'zgaruvchi | Qiymat |
|---|---|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `suhbat-media` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | R2 token qiymatlari |

(`S3_PUBLIC_ENDPOINT` kerak emas — R2 ham API, ham brauzer uchun bitta manzil.)

**Variant B — Railway Buckets** (agar akkauntingizda bor bo'lsa): loyihada **+ New → Bucket**,
bucket o'zgaruvchilarini (endpoint, kalitlar, nom) yuqoridagi `S3_*` ga reference qiling.
Agar xizmat faqat `bucket.host` uslubini qabul qilsa, `S3_FORCE_PATH_STYLE=false` qo'ying.
Bu variantni sinab ko'rmadim — brauzer uchun CORS'ni ham shu yerda sozlash kerak.

## 4. GitHub: API manzili va (ixtiyoriy) Android imzosi

1. GitHub repo → **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   `SUHBAT_API_URL` = API manzili (`https://api.suhbat.uz`, oxirida `/`siz). Desktop va Android
   shu manzilga ulanadigan qilib build bo'ladi. **Bo'lmasa release build ataylab yiqiladi.**
2. **Android imzosi (ixtiyoriy).** Secret'lar bo'lmasa APK vaqtinchalik kalit bilan
   imzolanadi va fayl nomi `...-sinov-uchun-debug-imzo.apk` bo'ladi (sinash uchun yetadi;
   do'konga yoki doimiy tarqatishga yaramaydi). Haqiqiy kalit yaratish (bir marta):
   ```bash
   keytool -genkeypair -v -keystore suhbat-release.keystore -alias suhbat \
     -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 suhbat-release.keystore      # macOS: base64 -i suhbat-release.keystore
   ```
   **Keystore faylini va parolni xavfsiz joyda saqlang** (parol menejer + zaxira nusxa):
   yo'qolsa ilovani mavjud o'rnatilganlar ustiga yangilab bo'lmaydi. Repoga **qo'shmang**.
   **Secrets → New repository secret:**
   `ANDROID_KEYSTORE_BASE64` (yuqoridagi base64 matni), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`suhbat`), `ANDROID_KEY_PASSWORD`. To'rttasi ham bo'lishi shart.

## 5. Birinchi release

PR `main`ga merge bo'lgach:
```bash
git checkout main && git pull
git tag v0.1.0
git push origin v0.1.0
```
(yoki GitHub → Releases → *Draft a new release* → yangi teg `v0.1.0` → Publish.)
**Actions → Release** ishlaydi (taxminan 20–40 daqiqa): macOS `dmg`, Windows `exe`, Android `apk`
**Releases** sahifasiga yuklanadi. Keyingi versiyalar — `v0.1.1`, `v0.2.0`, ...

Eslatma: desktop va mobil ilovalar **imzosiz** (Apple/Windows sertifikatlari yo'q) —
macOS'da Gatekeeper, Windows'da SmartScreen ogohlantiradi. iOS release hali yo'q.

## Taxminiy oylik narx (narxlar o'zgaradi — https://railway.com/pricing va https://developers.cloudflare.com/r2/pricing dan tekshiring)

- Railway Hobby: **$5/oy** (shuning ichida $5 resurs kreditlari). Kichik API (0,5 GB RAM atrofida) +
  Postgres odatda **~$5–15/oy** ishlatadi; foydalanuvchilar ko'paysa o'sadi.
- Cloudflare R2: 10 GB gacha bepul, undan keyin ~$0,015/GB-oy, chiqish puli yo'q.
- Netlify bepul tarif: kichik sayt uchun yetadi.
- GitHub Actions: private repoda macOS daqiqalari qimmatroq hisoblanadi (bepul limitga ta'sir qiladi).
- **Jami taxminan $5–15/oy.** Bu taxmin, kafolat emas.

## Nima sinalgan, nima yo'q

Sinalgan (lokal / CI): API Docker image qurilishi, non-root, `prisma migrate deploy` + `/health`
haqiqiy Postgres bilan, saqlash yo'q holatda API ko'tarilishi va media xatosi 503 ekani;
Android imzolash yo'li (CI'da vaqtinchalik kalit bilan).

**Sinalmagan:** Railway'ning o'zida deploy (akkauntga kira olmadim), Railway proksisi ortida
`TRUST_PROXY=1` yetarliligi, R2/Railway Buckets bilan haqiqiy yuklash va CORS, Netlify
deploy, `v*` tegi bilan to'liq release (macOS/Windows/Android), haqiqiy keystore bilan imzolash.
Birinchi deploy'da muammo chiqsa — Railway **Deploy logs** matnini yuboring.
