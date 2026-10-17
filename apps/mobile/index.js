import { AppRegistry } from 'react-native';
import { App } from './src/App';
import { getAppServices } from './src/services/createServices';
import { registerBackgroundHandler } from './src/services/push';
import { name as appName } from './app.json';

// Fon xabarlari ishlovchisi `AppRegistry` dan oldin ro'yxatdan o'tishi kerak (FCM).
registerBackgroundHandler();
AppRegistry.registerComponent(appName, () => App);

// Android: fon ulanishi. Foreground service jarayonni oynasiz qayta ishga tushirganda (tizim
// o'ldirgan / telefon qayta yoqilgan) UI yo'q — ulanish va bildirishnomalarni shu yerda tiklaymiz.
void getAppServices().background.sync().catch(() => undefined);
