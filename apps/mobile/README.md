# Suhbat — mobil ilova

Ishga tushirish va umumiy ma'lumot — ildizdagi [`README.md`](../../README.md) ("Mobil" bo'limi).

## Push bildirishnomalar (FCM)

Push `@react-native-firebase/messaging` orqali ishlaydi (Android va iOS — ikkalasi ham FCM,
iOS'da FCM APNs orqali yetkazadi). Firebase konfiguratsiya fayllari **repoga tushmaydi**
(`.gitignore` da). Ular bo'lmasa ilova va build baribir ishlaydi — faqat push o'chiq bo'ladi.

| Platforma | Fayl | Qayerga qo'yiladi (lokal) | CI secret |
|---|---|---|---|
| Android | `google-services.json` | `apps/mobile/android/app/google-services.json` | `GOOGLE_SERVICES_JSON` (JSON yoki base64) |
| iOS | `GoogleService-Info.plist` | `apps/mobile/ios/Suhbat/GoogleService-Info.plist` | `GOOGLE_SERVICE_INFO_PLIST` (base64) |

Fayllarni Firebase konsolidan olish — [`QADAMLAR.md`](../../QADAMLAR.md), "Push bildirishnomalar".

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
