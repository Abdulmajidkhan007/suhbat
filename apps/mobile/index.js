import { AppRegistry } from 'react-native';
import { App } from './src/App';
import { registerBackgroundHandler } from './src/services/push';
import { name as appName } from './app.json';

// Fon xabarlari ishlovchisi `AppRegistry` dan oldin ro'yxatdan o'tishi kerak (FCM).
registerBackgroundHandler();
AppRegistry.registerComponent(appName, () => App);
