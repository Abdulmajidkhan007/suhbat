# suhbat — joylash (deploy) qo'llanmasi

> Texnik tafsilot. Oddiy tilda, qadamma-qadam yo'riqnoma — repo ildizidagi
> [`QADAMLAR.md`](../QADAMLAR.md). **Railway'da, R2'da va GitHub'da bosiladigan qadamlarni
> egasi bajaradi**; ularni men (Claude) sinab ko'ra olmadim — pastdagi "Nima sinalgan" bo'limiga qarang.

## Umumiy rasm

```
 brauzer ──► Railway: Veb (Caddy)   ──┐
 desktop / telefon ───────────────────┼──► Railway: API  ──► Railway: Postgres
                                      │         │
                                      └─────────┴──► Cloudflare R2 (rasm, fayl, ovoz)
```

| Qism | Qayerda | Nega |
|---|---|---|
| API (NestJS + WebSocket) | **Railway** (Docker) | Egasi qarori. WebSocket qo'llanadi. |
| Baza | **Railway Postgres** | Shu loyihada, ichki tarmoq orqali. |
| Media (fayllar) | **Cloudflare R2** (yoki Railway Buckets, 3-qadamga qarang) | S3-mos; kod `S3_*` env bilan ishlaydi; R2'da 10 GB bepul va chiqish (egress) puli yo'q. |
| Veb | **Railway** (Docker, Caddy) | Egasi qarori: hammasi bitta Railway loyihasida. `apps/web/Dockerfile` vebni quradi va kichik statik server (Caddy) bilan beradi; `apps/web/railway.toml` tayyor. |
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

> **Railway tuzoqlari:** (1) monorepoda Railway har workspace uchun service yaratadi — `desktop`/`mobile`
> ni o'chiring; (2) Railpack'ning Custom Build/Start buyruqlarini tozalang; (3) ishonchli yechim —
> service Variables'ga `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile` (veb uchun `apps/web/Dockerfile`).
> Bu amalda ishladi, `/health` ok.

## 2. Veb (Railway)

Veb ham shu Railway loyihasida alohida xizmat (API va Postgres yonida).

1. Loyihada **+ New → GitHub Repo →** `suhbat` (yana bir xizmat).
2. **Settings:** *Root Directory* — bo'sh; *Config file path* = `/apps/web/railway.toml`
   (Dockerfile yo'li, `/` tekshiruvi, watch paths shu faylda).
3. **Variables:** `VITE_API_URL` = API manzili (1.6 dagi, oxirida `/`siz). Railway uni Docker
   build-arg sifatida beradi; *u build vaqtida bundle'ga qotadi* — o'zgartirsangiz vebni qayta deploy qiling.
4. **Settings → Networking → Generate Domain** (yoki Custom Domain). Bu manzilni API'dagi
   `CORS_ORIGIN` ga qo'shing va API xizmatini qayta deploy qiling.

Image: `apps/web/Dockerfile` (kontekst — repo ildizi) — build bosqichida `core/client/ui-tokens` va veb
quriladi; runtime — `caddy:2-alpine`, non-root, `$PORT` ni tinglaydi (`apps/web/docker/Caddyfile`):
noma'lum yo'llar `index.html` ga (SPA), `/assets/*` uchun 1 yillik `immutable` kesh,
`index.html` uchun `no-cache`, gzip/zstd. Lokal tekshirish:
```bash
docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=http://localhost:4000 -t suhbat-web .
docker run --rm -e PORT=8080 -p 8080:8080 suhbat-web      # http://localhost:8080
```

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

PR `main`ga merge bo'lgach. Telefondan: GitHub → **Actions → Release → Run workflow** (branch `main`,
*tag* = `v0.1.0`) — teg va release `main` dagi commit'ga o'zi yaratiladi. Yoki terminalda:
```bash
git checkout main && git pull
git tag v0.1.0
git push origin v0.1.0
```
(yoki GitHub → Releases → *Draft a new release* → yangi teg `v0.1.0` → Publish; release oldindan bo'lsa,
workflow fayllarni unga `--clobber` bilan yuklaydi.)
**Actions → Release** ishlaydi (taxminan 20–40 daqiqa): macOS `dmg`, Windows `exe`, Android `apk`
**Releases** sahifasiga yuklanadi. Keyingi versiyalar — `v0.1.1`, `v0.2.0`, ...
Release matni — `CHANGELOG.md` dagi `## vX.Y.Z` bo'limi (`scripts/release-notes.sh`; bo'lim yo'q bo'lsa `check`
job yiqiladi; release oldindan bo'lsa matni ham `gh release edit` bilan yangilanadi). Web/desktop/mobile
`package.json` versiyasi build'dan oldin tegdan o'rnatiladi (`scripts/release-version.sh`).

Eslatma: desktop va mobil ilovalar **imzosiz** (Apple/Windows sertifikatlari yo'q) —
macOS'da Gatekeeper, Windows'da SmartScreen ogohlantiradi. iOS release hali yo'q.

## Taxminiy oylik narx (narxlar o'zgaradi — https://railway.com/pricing va https://developers.cloudflare.com/r2/pricing dan tekshiring)

- Railway Hobby: **$5/oy** (shuning ichida $5 resurs kreditlari). Kichik API (0,5 GB RAM atrofida) +
  Postgres odatda **~$5–15/oy** ishlatadi; foydalanuvchilar ko'paysa o'sadi.
- Cloudflare R2: 10 GB gacha bepul, undan keyin ~$0,015/GB-oy, chiqish puli yo'q.
- Veb xizmati (Caddy) juda yengil — odatda bir necha dollar ichida; u ham Railway kreditidan ketadi.
- GitHub Actions: private repoda macOS daqiqalari qimmatroq hisoblanadi (bepul limitga ta'sir qiladi).
- **Jami taxminan $5–15/oy.** Bu taxmin, kafolat emas.

## Nima sinalgan, nima yo'q

Sinalgan (lokal / CI): veb Docker image (Caddy: `$PORT`, SPA fallback, kesh, non-root), API Docker image qurilishi, non-root, `prisma migrate deploy` + `/health`
haqiqiy Postgres bilan, saqlash yo'q holatda API ko'tarilishi va media xatosi 503 ekani;
Android imzolash yo'li (CI'da vaqtinchalik kalit bilan).

**Sinalmagan:** Railway'ning o'zida deploy (akkauntga kira olmadim), Railway proksisi ortida
`TRUST_PROXY=1` yetarliligi, R2/Railway Buckets bilan haqiqiy yuklash va CORS, vebning Railway'dagi
deploy'i (Dockerfile lokal/CI'da tekshirilgan), `v*` tegi bilan to'liq release (macOS/Windows/Android), haqiqiy keystore bilan imzolash.
Birinchi deploy'da muammo chiqsa — Railway **Deploy logs** matnini yuboring.
