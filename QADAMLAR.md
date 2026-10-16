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
- Nomi `SUHBAT_API_URL`
- Qiymati — API manzili **to'liq**, `https://` bilan boshlanib, oxirida `/` **siz**:

| | Qiymat |
|---|---|
| ✅ To'g'ri | `https://suhbatapi-production.up.railway.app` |
| ❌ Noto'g'ri | `suhbatapi-production.up.railway.app` (`https://` yo'q — telefonda "Tarmoq xatosi") |
| ❌ Noto'g'ri | `https://suhbatapi-production.up.railway.app/` (oxirida `/`) |
| ❌ Noto'g'ri | `http://...` (Android release faqat `https://` bilan ishlaydi) |

Desktop va Android ilovalar shu manzilga ulanadigan qilib quriladi (manzil ilova ichiga qotadi —
o'zgartirsangiz, yangi release kerak). Qiymat bo'sh yoki `https://` siz bo'lsa **release build ataylab
yiqiladi** va Actions logida sababi yoziladi.

## 9. (Ixtiyoriy) Android imzosi — telefonda, Termux bilan

Bo'lmasa APK vaqtinchalik kalit bilan imzolanadi (fayl nomi `...-sinov-uchun-debug-imzo.apk`) —
sinash uchun yetadi, lekin **har release'da kalit boshqa**: yangi versiyani o'rnatish uchun eskisini
o'chirish kerak bo'ladi. Doimiy kalit bir marta yaratiladi va keyin hamma release shu kalit bilan
imzolanadi.

> ⚠️ **Muhim:**
> - Keystore fayli va parollarni **hech qachon** chatga (shu jumladan Claude'ga), repoga, issue/PR'ga
>   yubormang va skrinshot qilmang. Ular faqat GitHub **Secrets** ga kiritiladi.
> - Keystore'ning **zaxira nusxasini** saqlang (masalan, shifrlangan arxivda bulutga + kompyuterga) va
>   parollarni parol menejeriga yozib qo'ying. Kalit yoki parol yo'qolsa, o'rnatilgan ilovani **yangilab
>   bo'lmaydi** — hamma foydalanuvchi uni o'chirib qayta o'rnatishi kerak bo'ladi (Play Market'ga
>   chiqqandan keyin esa umuman yangilab bo'lmaydi).

### 9.1. Termux'ni o'rnatish
Termux'ni **F-Droid** dan o'rnating (https://f-droid.org/packages/com.termux/). Play Market'dagi
versiyasi eskirgan va paketlar o'rnatilmasligi mumkin.

### 9.2. Kalit yaratish
Termux'ni oching va buyruqlarni birma-bir kiriting:
```bash
pkg update -y
pkg install -y openjdk-17
termux-setup-storage            # telefon xotirasiga ruxsat so'raydi — "Ruxsat berish"
cd ~
keytool -genkeypair -v -keystore suhbat-release.keystore -alias suhbat \
  -keyalg RSA -keysize 2048 -validity 10000
```
`keytool` so'raydi:
1. **Keystore paroli** (kamida 6 belgi) — ikki marta. Bu `ANDROID_KEYSTORE_PASSWORD`.
2. Ism, tashkilot, shahar, mamlakat (`UZ`) — ixtiyoriy, Enter bosib o'tsa ham bo'ladi; oxirida `yes`.

Kalit paroli alohida so'ralmaydi (PKCS12 formatida u keystore paroli bilan bir xil) —
`ANDROID_KEY_PASSWORD` ham shu parol.

Kompyuterda bo'lsangiz ham xuddi shu `keytool` buyrug'i (JDK 17+ kerak); macOS'da base64: `base64 -i suhbat-release.keystore`.

### 9.3. base64 matnini olish
```bash
base64 -w0 suhbat-release.keystore > suhbat-release.keystore.b64
cp suhbat-release.keystore suhbat-release.keystore.b64 ~/storage/downloads/
```
Endi telefonning **Downloads** papkasida ikki fayl bor: `suhbat-release.keystore` (zaxiralang!) va
`suhbat-release.keystore.b64` (bir qatorli matn). `.b64` faylni matn muharririda oching va **butun
matnni** nusxalang (yoki Termux'da `cat suhbat-release.keystore.b64` — uzun bitta qator).

### 9.4. GitHub secret'lari
GitHub → repo → **Settings → Secrets and variables → Actions → Secrets → New repository secret**.
To'rttasi ham shart (bittasi yo'q bo'lsa vaqtinchalik kalit ishlatiladi):

| Nomi | Qiymati |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `.b64` fayldagi butun matn |
| `ANDROID_KEYSTORE_PASSWORD` | 9.2 dagi keystore paroli |
| `ANDROID_KEY_ALIAS` | `suhbat` |
| `ANDROID_KEY_PASSWORD` | keystore paroli bilan bir xil |

### 9.5. Tozalash
Secret'larni saqlagach, `.b64` faylini o'chiring (keystore'ning o'zi zaxirada qolsin):
```bash
rm ~/suhbat-release.keystore.b64 ~/storage/downloads/suhbat-release.keystore.b64
```
Keyingi release'da APK nomi `suhbat-vX.Y.Z.apk` bo'ladi (`sinov-uchun` so'zisiz). Vaqtinchalik kalit
bilan imzolangan eski APK o'rnatilgan bo'lsa, birinchi marta uni o'chirib, yangisini o'rnating.

## 10. Birinchi release (`v0.1.0`)

PR'lar `main`ga merge bo'lgach. **Telefondan (terminalsiz):** GitHub → **Actions → Release →
Run workflow** → Branch: `main`, *tag* = `v0.1.0` → **Run workflow**. Workflow `main` dagi commit'ga
`v0.1.0` tegi va release'ni o'zi yaratadi.
(Terminalda: `git checkout main && git pull && git tag v0.1.0 && git push origin v0.1.0`. Yoki GitHub →
**Releases → Draft a new release** → yangi teg → **Publish**: release oldindan bo'lsa ham, workflow
fayllarni unga yuklab qo'yadi.)
GitHub **Actions → Release** ishlaydi (taxminan 20–40 daqiqa); macOS `dmg`, Windows `exe` va Android `apk`
**Releases** sahifasiga yuklanadi. Keyingi versiyalar: `v0.1.1`, `v0.2.0`, ...
Ilovalar imzosiz: macOS/Windows ogohlantirish ko'rsatadi (normal). iOS hali yo'q.

**Har release'dan oldin:** `CHANGELOG.md` da shu teg nomli bo'lim bo'lsin (masalan `## v0.3.0`) — release
matni shundan olinadi; bo'lim bo'lmasa workflow birinchi qadamda to'xtaydi. Versiya raqami (desktop fayl nomi,
ilovadagi "Suhbat v…") tegdan avtomatik olinadi — `package.json` ni qo'lda o'zgartirish shart emas.

## Railway tuzoqlari (amalda uchragan)

- Railway monorepoda **har workspace uchun avtomatik service** yaratadi — kerakmaslarini
  (`desktop`, `mobile`) **Settings → Delete service** bilan o'chiring. Faqat API va Web qoladi.
- **Railpack** (avtomatik build) o'zi taxmin qilgan yoki qo'lda yozilgan *Custom Build Command* /
  *Custom Start Command* larni ishlatadi: Settings'da ikkalasini ham **tozalang** (bo'sh qoldiring).
- Ishonchli yechim — service **Variables**'ga Dockerfile yo'lini berish:
  API uchun `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`, Web uchun
  `RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile`. Shunda Railway Railpack o'rniga Dockerfile bilan quradi.
  Bu usul amalda ishladi (`/health` ok).

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

## 13. Qo'ng'iroqlar uchun TURN server (ixtiyoriy, lekin tavsiya etiladi)

**Nima uchun kerak.** Qo'ng'iroqda ovoz/video serverimiz orqali emas, ikki qurilma orasida to'g'ridan-to'g'ri
yuradi. Ko'p hollarda (bir xil Wi-Fi, oddiy uy interneti) bu ishlaydi. Lekin mobil internet (operator NAT'i),
ofis/korporativ tarmoq yoki ba'zi routerlar ortida to'g'ridan-to'g'ri ulanib bo'lmaydi — shunda qo'ng'iroq
"Ulanmoqda…" da qolib, keyin "Ulanib bo'lmadi" bo'ladi. **TURN** — shunday paytda ovoz/videoni o'zi orqali
uzatadigan server. Railway UDP portlarni ochmaydi, shuning uchun TURN'ni Railway'ga qo'yib **bo'lmaydi** —
quyidagi variantlardan biri kerak.

TURN sozlanmasa ham qo'ng'iroq ishlaydi (Google'ning bepul STUN serveri bilan), faqat yuqoridagi tarmoqlarda
ulanmasligi mumkin.

### 13.1. Eng oson: metered.ca (bepul tarif bor)
1. https://www.metered.ca/ → ro'yxatdan o'ting → **TURN Server** bo'limi.
2. U sizga manzillar ro'yxati (`turn:...:80`, `turn:...:443?transport=tcp`, `turns:...:443` kabi),
   **username** va **credential** beradi.
3. Railway → API xizmati → **Variables**:
   - `TURN_URLS` — manzillarni **vergul bilan** bitta qatorda: `turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443?transport=tcp,turns:a.relay.metered.ca:443`
   - `TURN_USERNAME` — berilgan username
   - `TURN_CREDENTIAL` — berilgan credential (maxfiy — hech kimga yubormang)
4. Bepul tarifda oylik trafik cheklangan; ko'p video qo'ng'iroq bo'lsa pullik tarif kerak bo'ladi.

### 13.2. Cloudflare (Realtime / Calls TURN)
Cloudflare TURN'i ham bor, lekin u login/parolni **har safar API orqali yaratishni** talab qiladi
(qisqa muddatli). Hozirgi kodimiz buni avtomatik qilmaydi — faqat qo'lda yaratilgan credential'ni
(muddati tugaguncha) `TURN_USERNAME` / `TURN_CREDENTIAL` ga qo'yish mumkin, muddati tugagach almashtirish
kerak bo'ladi. Shuning uchun hozircha 13.1 yoki 13.3 tavsiya etiladi; Cloudflare kerak bo'lsa ayting —
API'ga avtomatik yaratishni qo'shamiz.

### 13.3. O'z serveringiz: VPS'da coturn (eng ko'p nazorat)
1. Har qanday arzon VPS (Hetzner, DigitalOcean va h.k.; 1 GB RAM yetadi), ochiq IP bilan.
2. Domen (masalan `turn.suhbat.uz`) VPS IP'siga yo'naltiriladi.
3. VPS'da: `apt install coturn`, `/etc/turnserver.conf` ichida asosiysi:
   ```
   listening-port=3478
   tls-listening-port=5349
   realm=turn.suhbat.uz
   use-auth-secret
   static-auth-secret=<uzun tasodifiy qiymat: openssl rand -hex 32>
   cert=/etc/letsencrypt/live/turn.suhbat.uz/fullchain.pem
   pkey=/etc/letsencrypt/live/turn.suhbat.uz/privkey.pem
   no-cli
   ```
   Firewall'da ochiq bo'lsin: 3478 (UDP+TCP), 5349 (TCP), 49152–65535 (UDP).
4. Railway → API → **Variables**:
   - `TURN_URLS` = `turn:turn.suhbat.uz:3478?transport=udp,turn:turn.suhbat.uz:3478?transport=tcp,turns:turn.suhbat.uz:5349`
   - `TURN_SECRET` = coturn'dagi `static-auth-secret` bilan **aynan bir xil** qiymat.
   API har foydalanuvchiga vaqtinchalik (standart 12 soat, `TURN_TTL_SECONDS`) login/parol yasaydi —
   secret'ning o'zi ilovalarga hech qachon bormaydi.
5. VPS sozlashni xohlasangiz, birga qadam-baqadam qilamiz.

### 13.4. Tekshirish
1. Brauzerda ilovaga kiring va `https://<API manzili>/calls/ice-servers` ni oching — `401` qaytadi (to'g'ri:
   faqat kirgan foydalanuvchiga). Ilova ichida esa qo'ng'iroq boshlanganda shu ro'yxat olinadi.
2. Ikki xil tarmoqda (masalan biri Wi-Fi, biri mobil internet) video qo'ng'iroq qilib ko'ring.
   "Ulanib bo'lmadi" chiqsa — TURN sozlamalari va firewall'ni tekshiring, Railway API logini menga yuboring.

## 14. Parolni tiklash uchun email (Resend)

Busiz ham ilova ishlaydi, lekin **"Parolni unutdim?"** bosilganda "Email yuborish hozircha sozlanmagan"
chiqadi. Xat yuborish uchun **Resend** (bepul tarif: kuniga 100 ta xat) ishlatiladi.
Resend akkauntiga men kira olmayman — quyidagilarni **siz** qilasiz.

> ⚠️ **API kalitini (`re_...`) hech kimga yubormang — menga ham, chatga ham yozmang.**
> U faqat Railway **Variables** ga kiritiladi. Tasodifan biror joyga yozib yuborsangiz —
> Resend'da o'sha kalitni o'chirib (**Delete**), yangisini yarating.

### 14.1. Akkaunt va kalit
1. https://resend.com → **Sign up** (Google yoki email bilan).
2. Chap menyu **API Keys → Create API Key**: nomi `suhbat-api`, **Permission = Sending access** → **Add**.
3. Chiqqan kalitni (`re_` bilan boshlanadi) nusxalang — u **faqat bir marta** ko'rsatiladi.

### 14.2. Kimdan yuboriladi (domen)
- **Sinov uchun (domensiz):** `onboarding@resend.dev` manzilidan yuborish mumkin, **lekin** xat faqat
  **Resend akkauntingiz emailiga** boradi (boshqa odamlarga bormaydi). O'zingiz sinab ko'rish uchun yetarli.
- **Haqiqiy foydalanuvchilar uchun:** o'z domeningiz kerak (masalan `suhbat.uz`).
  Resend → **Domains → Add Domain** → domenni yozing → ko'rsatilgan DNS yozuvlarini (TXT, MX)
  domen sotib olgan joyingizda (DNS sozlamalari) qo'shing → Resend'da **Verify** yashil bo'lguncha kuting
  (bir necha daqiqadan bir necha soatgacha).

### 14.3. Railway'ga qo'shish
Railway → **API xizmati → Variables → New Variable** — uchtasini qo'shing:

| Nomi | Qiymati |
|---|---|
| `RESEND_API_KEY` | 14.1 dagi kalit (`re_...`) |
| `MAIL_FROM` | sinovda: `Suhbat <onboarding@resend.dev>`; domen tasdiqlangach: `Suhbat <noreply@suhbat.uz>` |
| `WEB_URL` | `https://suhbatweb-production.up.railway.app` (oxirida `/` siz; veb manzilingiz o'zgarsa — shuni yangilang) |

API qayta deploy bo'ladi. **Deploy Logs** da `RESEND_API_KEY / SMTP_URL yo'q` yoki `WEB_URL yo'q`
ogohlantirishi **chiqmasa** — ulandi.

### 14.4. Tekshirish
1. Vebda **Kirish → Parolni unutdim?** → Resend akkauntingiz emailini (yoki shu email bilan ochilgan
   Suhbat hisobini / username'ini) kiriting → **Havola yuborish**.
2. Pochtaga "Suhbat: parolni tiklash" xati keladi (kelmasa **Spam** papkasini ham ko'ring).
3. Xatdagi tugmani bosing → yangi parolni ikki marta kiriting → **Parolni saqlash**.
4. Yangi parol bilan kiring. Eslatma: parol o'zgargach **hamma qurilmalardan chiqasiz** (telefon ham) —
   bu xavfsizlik uchun ataylab shunday.
5. Xat kelmasa: Railway API **Deploy Logs** dagi `PasswordResetService` qatorlarini menga yuboring
   (kalitni emas). Resend → **Emails** bo'limida ham xat holati ko'rinadi.

> Ixtiyoriy: Resend o'rniga istalgan SMTP (masalan Gmail emas, balki pochta xizmatingizning SMTP'si)
> — `SMTP_URL=smtps://login:parol@smtp.example.uz:465`. `RESEND_API_KEY` bo'lsa Resend ustun.
