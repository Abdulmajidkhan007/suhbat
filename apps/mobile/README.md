# Suhbat — mobil ilova

Ishga tushirish va build — [`docs/DEVELOPMENT.md`](../../docs/DEVELOPMENT.md#mobil-react-native-cli) ("Mobil" bo'limi); loyiha haqida — [`README.md`](../../README.md).

## Dizayn ("Pulse UI" uslubi) va tuzilma

- `src/theme/` — `colors.ts` (yorug'/qorong'i palitra, `@suhbat/ui-tokens` `Palette` ning kengaytmasi), `accents.ts`
  (7 ta asosiy rang), `typography.ts`, `metrics.ts` (masofa, radius, soya, `HIT` = 44 px). `ThemeProvider` — rejim
  (`system | light | dark`) va asosiy rang; tanlov qurilmada saqlanadi (`services/prefsStorage.ts`, Keychain'dagi alohida `service`).
- `src/i18n/` — `uz.ts` (barcha matnlar, tipli kalitlar) va `t(key, params)`. Yangi til — shu kalitlar bilan yangi fayl.
- `src/components/` — `icon/` (Ionicons 8 yo'llari `react-native-svg` bilan; ro'yxat `scripts/gen-mobile-icons.py`),
  `Avatar` (id bo'yicha rang), `ScreenHeader`, `IconButton`, `ListRow`, `Section`, `EmptyState`/`LoadingState`,
  `SearchField`, `PrimaryButton`, `ActionSheet` (pastdan chiquvchi menyu), `TabBar`, `ConnectionBanner`,
  `ChatListItem`, `MessageBubble` (+ `StatusTick`, `DateSeparator`), `Composer` (tahrirlash rejimi bilan), `UserPicker`.
- `src/navigation/` — o'z stek navigatori + pastki tablar (Suhbatlar / Sozlamalar), Android "orqaga", `ScreenTransition`
  (o'ngdan surilish, "harakatni kamaytirish" yoqilgan bo'lsa — animatsiyasiz). React Navigation qo'shilmadi: ekranlar kam,
  `react-native-screens`/`gesture-handler`/`reanimated` native build xavfini oshiradi.
- Haptics: `utils/haptics.ts` (`react-native-haptic-feedback`) — uzun bosish, tab, yuborish, saqlash.
- Nusxa olish: `@react-native-clipboard/clipboard`.

## Bildirishnomalar FCM'siz (Android) — asosiy yo'l

`src/background/` + `android/.../background/` (Kotlin): kirgan foydalanuvchi uchun socket'dagi
`message:new` / `call:invite` ilova ko'rinmay turganda **mahalliy bildirishnoma** bo'ladi (kanallar
`messages`, `calls`; bosilsa chat ochiladi). **Sozlamalar → "Fonda ulanib turish"** yoqilsa
foreground service (`remoteMessaging`, doimiy "Suhbat ulangan" bildirishnomasi) jarayonni va
Socket.IO ulanishini ilova yopilganda ham saqlaydi; telefon qayta yoqilganda `BootReceiver` tiklaydi,
yoqilganda batareya optimizatsiyasidan chiqarish so'raladi. UI va fon bitta socket'ni ishlatadi
(`getAppServices`, `ConnectionKeeper`). Matn mantig'i — `@suhbat/client` `createMessageNotifier`.

**iOS:** Apple fonda o'z ulanishini ushlashga ruxsat bermaydi — ilova yopiq/fonda bo'lsa
bildirishnoma faqat APNs orqali (pastdagi FCM yo'li, Apple Developer akkaunti kerak).

## Push bildirishnomalar (FCM, ixtiyoriy)

Push `@react-native-firebase/messaging` orqali ishlaydi (Android va iOS — ikkalasi ham FCM,
iOS'da FCM APNs orqali yetkazadi). Firebase konfiguratsiya fayllari **repoga tushmaydi**
(`.gitignore` da). Ular bo'lmasa ilova va build baribir ishlaydi — faqat push o'chiq bo'ladi.

| Platforma | Fayl | Qayerga qo'yiladi (lokal) | CI secret |
|---|---|---|---|
| Android | `google-services.json` | `apps/mobile/android/app/google-services.json` | `GOOGLE_SERVICES_JSON` (JSON yoki base64) |
| iOS | `GoogleService-Info.plist` | `apps/mobile/ios/Suhbat/GoogleService-Info.plist` | `GOOGLE_SERVICE_INFO_PLIST` (base64) |

Fayllarni Firebase konsolidan olish — [`docs/QADAMLAR-TAFSILOT.md`](../../docs/QADAMLAR-TAFSILOT.md), "Firebase (FCM)".

### Qanday ulangan
- **Android:** `android/app/build.gradle` — fayl bo'lmasa, lekin `GOOGLE_SERVICES_JSON` env bo'lsa,
  fayl shundan yoziladi; fayl bo'lsa `com.google.gms.google-services` plagini qo'llanadi, bo'lmasa
  ogohlantirish bilan o'tkazib yuboriladi. Bildirishnoma kanali `messages` (`MainApplication.kt`,
  `firebase.json`). Android 13+ da `POST_NOTIFICATIONS` ruxsati kirgandan keyin so'raladi.
- **iOS:** `[Suhbat] GoogleService-Info.plist` build bosqichi faylni ilovaga nusxalaydi (bo'lsa);
  `AppDelegate.swift` `FirebaseApp.configure()` ni faqat fayl bo'lsa chaqiradi. Podfile —
  static frameworks, CocoaPods (SPM o'chiq). `Suhbat.entitlements` da `aps-environment`; haqiqiy
  qurilma uchun Apple Developer akkauntida Push Notifications yoqilgan bo'lishi va APNs kaliti
  Firebase'ga yuklangan bo'lishi kerak.
- **JS:** `src/services/push.ts` (Firebase o'rami; sozlanmagan bo'lsa `available: false`),
  `src/push/PushNotifications.tsx` (ruxsat → token → `POST /devices`, `onTokenRefresh`,
  in-app banner, bosilganda chatni ochish). Logout'da token serverdan (`/auth/logout`
  `deviceToken`) va FCM'dan o'chiriladi.

### Namuna (faqat shakli — haqiqiy qiymatlarni Firebase beradi)
```json
{
  "project_info": { "project_number": "000000000000", "project_id": "suhbat-xxxx", "storage_bucket": "suhbat-xxxx.firebasestorage.app" },
  "client": [{
    "client_info": { "mobilesdk_app_id": "1:000000000000:android:0000000000000000", "android_client_info": { "package_name": "uz.suhbat.app" } },
    "api_key": [{ "current_key": "AIza..." }]
  }],
  "configuration_version": "1"
}
```
Android paket nomi — `uz.suhbat.app`, iOS Bundle ID — `uz.suhbat.app`.

## Qo'ng'iroqlar (WebRTC)

- `react-native-webrtc` 124 (autolinking; Android `minSdk 24`, iOS — `JitsiWebRTC` pod). Mantiq —
  `@suhbat/client` (`createCallManager`), bu yerda faqat adapterlar (`src/calls/nativeWebrtc.ts`) va UI
  (`src/calls/CallOverlay.tsx`).
- Ruxsatlar: Android — `RECORD_AUDIO`, `CAMERA` (qo'ng'iroq boshlanganda so'raladi), Android 12+
  `BLUETOOTH_CONNECT` (ixtiyoriy); iOS — `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`.
- Kiruvchi qo'ng'iroq faqat ilova ochiq (socket ulangan) bo'lsa ekranga chiqadi. Oflayn bo'lsa server
  `calls` kanaliga push yuboradi; bosilganda ilova ochiladi va hali jiringlayotgan qo'ng'iroq qayta keladi.
- **Yo'q (keyin):** CallKit / ConnectionService (tizim qo'ng'iroq ekrani, qulflangan ekranda jiringlash),
  karnay/quloqchinni almashtirish (`react-native-incall-manager`), fonda qo'ng'iroqni davom ettirish
  (iOS `UIBackgroundModes: audio/voip`).
- Testlarda `react-native-webrtc` mock qilingan (`jest.setup.js`); haqiqiy media faqat qurilmada.
