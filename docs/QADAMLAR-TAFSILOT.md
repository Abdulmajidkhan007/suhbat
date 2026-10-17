# QADAMLAR — tafsilot (ixtiyoriy ishlar)

Asosiy ro'yxat — [`QADAMLAR.md`](../QADAMLAR.md). Bu yerda faqat uzun, ixtiyoriy yo'riqnomalar.

## 1. Android imzosi — telefonda, Termux bilan

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

### 1.1. Termux'ni o'rnatish
Termux'ni **F-Droid** dan o'rnating (https://f-droid.org/packages/com.termux/). Play Market'dagi
versiyasi eskirgan va paketlar o'rnatilmasligi mumkin.

### 1.2. Kalit yaratish
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

### 1.3. base64 matnini olish
```bash
base64 -w0 suhbat-release.keystore > suhbat-release.keystore.b64
cp suhbat-release.keystore suhbat-release.keystore.b64 ~/storage/downloads/
```
Endi telefonning **Downloads** papkasida ikki fayl bor: `suhbat-release.keystore` (zaxiralang!) va
`suhbat-release.keystore.b64` (bir qatorli matn). `.b64` faylni matn muharririda oching va **butun
matnni** nusxalang (yoki Termux'da `cat suhbat-release.keystore.b64` — uzun bitta qator).

### 1.4. GitHub secret'lari
GitHub → repo → **Settings → Secrets and variables → Actions → Secrets → New repository secret**.
To'rttasi ham shart (bittasi yo'q bo'lsa vaqtinchalik kalit ishlatiladi):

| Nomi | Qiymati |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `.b64` fayldagi butun matn |
| `ANDROID_KEYSTORE_PASSWORD` | 1.2 dagi keystore paroli |
| `ANDROID_KEY_ALIAS` | `suhbat` |
| `ANDROID_KEY_PASSWORD` | keystore paroli bilan bir xil |

### 1.5. Tozalash
Secret'larni saqlagach, `.b64` faylini o'chiring (keystore'ning o'zi zaxirada qolsin):
```bash
rm ~/suhbat-release.keystore.b64 ~/storage/downloads/suhbat-release.keystore.b64
```
Keyingi release'da APK nomi `suhbat-vX.Y.Z.apk` bo'ladi (`sinov-uchun` so'zisiz). Vaqtinchalik kalit
bilan imzolangan eski APK o'rnatilgan bo'lsa, birinchi marta uni o'chirib, yangisini o'rnating.

## 2. Firebase (FCM) — iOS push uchun yoki Android'da fon ulanishisiz

### 2.1. Firebase loyiha
1. https://console.firebase.google.com → **Add project** → nomi `suhbat` (Google Analytics kerak emas).

### 2.2. Android ilova
1. Loyiha ichida **Add app → Android**.
2. **Package name** = `uz.suhbat.app` (aynan shunday). Qolganlari bo'sh qolsin → **Register app**.
3. **`google-services.json`** ni yuklab oling. **Repoga qo'shmang.**
4. GitHub → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:
   nomi `GOOGLE_SERVICES_JSON`, qiymati — faylning **butun matni** (ochib, hammasini nusxalang).

### 2.3. iOS ilova (iPhone uchun; Apple Developer akkaunti kerak — $99/yil)
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

### 2.4. Server kaliti (API'ga)
1. Firebase → **Project settings → Service accounts → Generate new private key** → JSON fayl yuklanadi.
   **Bu maxfiy kalit** — hech kimga yubormang, repoga qo'shmang.
2. Railway → API xizmati → **Variables → New Variable**:
   nomi `FCM_SERVICE_ACCOUNT_JSON`, qiymati — JSON faylning **butun matni**
   (yoki base64: `base64 -w0 key.json`; macOS: `base64 -i key.json`).
3. API qayta deploy bo'ladi. Logda `FCM_SERVICE_ACCOUNT_JSON yo'q` ogohlantirishi **chiqmasa** — ulandi.

### 2.5. Tekshirish
1. Yangi APK'ni o'rnating (secret'lar qo'yilgandan **keyin** qurilgan build kerak).
2. Telefonda kiring → "Bildirishnomalarga ruxsat berasizmi?" → **Ruxsat berish**.
3. Ilovani yoping, boshqa hisobdan (masalan vebdan) xabar yozing — telefonga bildirishnoma kelishi kerak.
   Bosilganda shu chat ochiladi.
4. Kelmasa: Railway API **Deploy Logs** dagi `FcmClient` / `PushService` qatorlarini menga yuboring
   (kalit matnini emas).

> Eslatma: GitHub'dagi **Release** (`release.yml`) build'iga `GOOGLE_SERVICES_JSON` hali ulanmagan —
> u alohida ish sifatida qo'shiladi. Hozircha push faqat `Mobile` workflow APK'sida va lokal build'da ishlaydi.
