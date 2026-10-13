# suhbat — joylash qadamlari (egasi uchun)

Hammasi **Railway**'da: Postgres, API va veb — bitta loyihada. Kod tayyor, siz faqat
quyidagi tugmalarni bosasiz. Texnik tafsilot: [`docs/DEPLOY.md`](docs/DEPLOY.md).

> Ochiq gap: Railway'dagi deploy'ni men sinab ko'ra olmadim (akkauntga kira olmayman).
> Kod va Docker image'lar lokal/CI'da tekshirilgan. Biror qadamda xato chiqsa — **10-qadamga** qarang.

## 1. Railway akkaunti

1. https://railway.com ga **GitHub bilan** kiring.
2. **Hobby** tarifini yoqing (karta kerak, $5/oy). Bepul tarif uzoq ishlamaydi.

## 2. Loyiha

1. **New Project → Deploy from GitHub repo →** `suhbat` ni tanlang
   (Railway GitHub'ga ruxsat so'raydi — bering).
2. Bu **API xizmatini** yaratadi. Hozircha u xato bilan to'xtashi mumkin — normal, baza hali yo'q.

## 3. Postgres

1. Loyiha ichida **+ New → Database → Add PostgreSQL**.
2. Xizmat nomi `Postgres` bo'lib qolsin (pastdagi jadvalda shu nom ishlatilgan).

## 4. API xizmati

API xizmatini oching → **Settings**:
- **Root Directory** — *bo'sh qoldiring*.
- **Config file path** (Config-as-code) = `/apps/api/railway.toml`
- **Replicas** = `1` (bittadan ko'p bo'lmasin).

So'ng **Variables** → quyidagilarni qo'shing:

| Nomi | Qiymati |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (aynan shunday yozing, qo'lda ko'chirmang) |
| `JWT_SECRET` | uzun tasodifiy qator. Terminalda: `openssl rand -base64 48` |
| `CORS_ORIGIN` | hozircha `suhbat://app` (veb domenini 6-qadamda qo'shamiz) |
| `TRUST_PROXY` | `1` |

`PORT` ni **qo'ymang** — Railway o'zi beradi.

Keyin **Settings → Networking → Generate Domain** — API manzili chiqadi
(`https://....up.railway.app`). **Shu manzilni nusxalab qo'ying** — 5, 8 qadamlarda kerak.
O'z domeningiz bo'lsa (masalan `api.suhbat.uz`) — **Custom Domain** va ko'rsatilgan DNS yozuvini qo'shing.

**Tekshiruv:** brauzerda `https://API-MANZIL/health` oching. Quyidagi chiqishi kerak:
```
{"status":"ok","db":"up"}
```
Chiqmasa — 10-qadam.

## 5. Veb xizmati

1. Loyihada **+ New → GitHub Repo →** `suhbat` (yana bir xizmat — ikkinchi nusxa).
2. **Settings:**
   - **Root Directory** — *bo'sh*.
   - **Config file path** = `/apps/web/railway.toml`
3. **Variables:** `VITE_API_URL` = 4-qadamdagi **API manzili**, oxirida `/` **siz**
   (masalan `https://suhbat-api.up.railway.app`).
   Bu qiymat build vaqtida qotadi: keyin o'zgartirsangiz vebni qayta deploy qiling.
4. **Settings → Networking → Generate Domain** (yoki Custom Domain, masalan `suhbat.uz`).
   Veb manzilini nusxalang.
5. Deploy tugagach veb manzilini oching — kirish ekrani chiqishi kerak.

## 6. API'ga veb manzilini bildirish (CORS)

API xizmati → **Variables** → `CORS_ORIGIN` ni shunday qiling (vergul bilan, probelsiz):
```
https://VEB-MANZIL,suhbat://app
```
(`suhbat://app` — desktop ilova uchun.) Saqlang va API qayta deploy bo'lishini kuting.
Shundan keyin vebda ro'yxatdan o'tib ko'ring.

## 7. (Ixtiyoriy) Fayl saqlash — Cloudflare R2

Busiz ham hammasi ishlaydi, faqat **rasm/fayl/ovoz yuborish** ishlamaydi.

1. https://cloudflare.com → **R2** → bucket yarating (masalan `suhbat-media`).
2. **Manage R2 API Tokens → Create** (Object Read & Write, shu bucket) → *Access Key ID* va *Secret*ni saqlang.
3. Bucket → **Settings → CORS policy**:
   ```json
   [{"AllowedOrigins": ["https://VEB-MANZIL", "suhbat://app"],
     "AllowedMethods": ["GET", "PUT", "HEAD"],
     "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600}]
   ```
4. Railway API **Variables**:

| Nomi | Qiymati |
|---|---|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `suhbat-media` |
| `S3_ACCESS_KEY` | R2 *Access Key ID* |
| `S3_SECRET_KEY` | R2 *Secret* |

## 8. GitHub: API manzili

GitHub repo → **Settings → Secrets and variables → Actions → Variables → New repository variable**:
- Nomi `SUHBAT_API_URL`, qiymati — API manzili (oxirida `/` siz).

Desktop va Android ilovalar shu manzilga ulanadigan qilib quriladi. **Bu bo'lmasa release build ataylab yiqiladi.**

## 9. (Ixtiyoriy) Android imzosi

Bo'lmasa APK vaqtinchalik kalit bilan imzolanadi (fayl nomi `...-sinov-uchun-debug-imzo.apk`) —
sinash uchun yetadi, do'kon yoki doimiy tarqatish uchun yaramaydi. Haqiqiy kalit (bir marta):
```bash
keytool -genkeypair -v -keystore suhbat-release.keystore -alias suhbat \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 suhbat-release.keystore      # macOS: base64 -i suhbat-release.keystore
```
**Keystore faylini va parolni xavfsiz joyda saqlang** (yo'qolsa, o'rnatilgan ilovani yangilab bo'lmaydi).
Repoga **qo'shmang**. GitHub → **Settings → Secrets and variables → Actions → Secrets** ga 4 ta qo'shing
(to'rttasi ham shart):
`ANDROID_KEYSTORE_BASE64` (yuqoridagi base64 matni), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` (`suhbat`), `ANDROID_KEY_PASSWORD`.

## 10. Birinchi release (`v0.1.0`)

PR'lar `main`ga merge bo'lgach, terminalda:
```bash
git checkout main && git pull
git tag v0.1.0
git push origin v0.1.0
```
(Yoki GitHub → **Releases → Draft a new release** → yangi teg `v0.1.0` → **Publish**.)
GitHub **Actions → Release** ishlaydi (taxminan 20–40 daqiqa); macOS `dmg`, Windows `exe` va Android `apk`
**Releases** sahifasiga yuklanadi. Keyingi versiyalar: `v0.1.1`, `v0.2.0`, ...
Ilovalar imzosiz: macOS/Windows ogohlantirish ko'rsatadi (normal). iOS hali yo'q.

## 11. Muammo bo'lsa nima yuborish kerak

Menga quyidagini yuboring:
1. **Qaysi xizmat** (API yoki Web) va **qaysi qadam**da to'xtadi.
2. Railway'da xizmat → **Deployments** → oxirgi deploy → **Build Logs** va **Deploy Logs** matni
   (ekran rasmi emas, matnni nusxalang; oxirgi ~50 qator yetadi).
3. Brauzer xatosi bo'lsa: sahifada **F12 → Console** dagi qizil xato matni.

**Parol, `JWT_SECRET`, `S3_SECRET_KEY` va `DATABASE_URL` ni yubormang** — logda ular ko'rinib qolsa, o'chirib yuboring.

## 12. Push bildirishnomalar (Firebase)

Busiz ham ilova ishlaydi — faqat telefonga "yangi xabar" bildirishnomasi kelmaydi.
Kod tayyor; quyidagilarni **siz** qilasiz (Firebase va Apple akkauntlariga men kira olmayman).

### 12.1. Firebase loyiha
1. https://console.firebase.google.com → **Add project** → nomi `suhbat` (Google Analytics kerak emas).

### 12.2. Android ilova
1. Loyiha ichida **Add app → Android**.
2. **Package name** = `uz.suhbat.app` (aynan shunday). Qolganlari bo'sh qolsin → **Register app**.
3. **`google-services.json`** ni yuklab oling. **Repoga qo'shmang.**
4. GitHub → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:
   nomi `GOOGLE_SERVICES_JSON`, qiymati — faylning **butun matni** (ochib, hammasini nusxalang).

### 12.3. iOS ilova (iPhone uchun; Apple Developer akkaunti kerak — $99/yil)
1. Firebase → **Add app → iOS**, **Bundle ID** = `uz.suhbat.app` → **Register app**.
2. **`GoogleService-Info.plist`** ni yuklab oling. **Repoga qo'shmang.**
3. Terminalda base64 qiling: `base64 -i GoogleService-Info.plist` (macOS) va natijani GitHub secret
   `GOOGLE_SERVICE_INFO_PLIST` ga qo'ying.
4. https://developer.apple.com → **Certificates, IDs & Profiles → Keys → +** →
   **Apple Push Notifications service (APNs)** belgilang → kalitni (`.p8`) yuklab oling,
   **Key ID** va **Team ID** ni yozib oling.
5. Firebase → **Project settings → Cloud Messaging → Apple app configuration → APNs Authentication Key →
   Upload**: `.p8` fayl, Key ID, Team ID.
6. developer.apple.com → **Identifiers** → `uz.suhbat.app` → **Push Notifications** yoqilgan bo'lsin.

### 12.4. Server kaliti (API'ga)
1. Firebase → **Project settings → Service accounts → Generate new private key** → JSON fayl yuklanadi.
   **Bu maxfiy kalit** — hech kimga yubormang, repoga qo'shmang.
2. Railway → API xizmati → **Variables → New Variable**:
   nomi `FCM_SERVICE_ACCOUNT_JSON`, qiymati — JSON faylning **butun matni**
   (yoki base64: `base64 -w0 key.json`; macOS: `base64 -i key.json`).
3. API qayta deploy bo'ladi. Logda `FCM_SERVICE_ACCOUNT_JSON yo'q` ogohlantirishi **chiqmasa** — ulandi.

### 12.5. Tekshirish
1. Yangi APK'ni o'rnating (secret'lar qo'yilgandan **keyin** qurilgan build kerak).
2. Telefonda kiring → "Bildirishnomalarga ruxsat berasizmi?" → **Ruxsat berish**.
3. Ilovani yoping, boshqa hisobdan (masalan vebdan) xabar yozing — telefonga bildirishnoma kelishi kerak.
   Bosilganda shu chat ochiladi.
4. Kelmasa: Railway API **Deploy Logs** dagi `FcmClient` / `PushService` qatorlarini menga yuboring
   (kalit matnini emas).

> Eslatma: GitHub'dagi **Release** (`release.yml`) build'iga `GOOGLE_SERVICES_JSON` hali ulanmagan —
> u alohida ish sifatida qo'shiladi. Hozircha push faqat `Mobile` workflow APK'sida va lokal build'da ishlaydi.
