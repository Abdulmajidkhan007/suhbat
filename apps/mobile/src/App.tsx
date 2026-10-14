import { ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CallOverlay } from './calls/CallOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NavigationProvider, useNavigation } from './navigation/Navigator';
import { PushNotifications } from './push/PushNotifications';
import { AuthScreen } from './screens/AuthScreen';
import { ChatListScreen } from './screens/ChatListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { NewChatScreen } from './screens/NewChatScreen';
import type { Services } from './services/createServices';
import { ChatStoreProvider } from './state/ChatStoreProvider';
import { SessionProvider, useSession } from './state/SessionProvider';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';

const Screens = () => {
  const { route } = useNavigation();
  switch (route.name) {
    case 'chats':   return <ChatListScreen />;
    case 'chat':    return <ChatScreen key={route.chatId} chatId={route.chatId} />;
    case 'newChat': return <NewChatScreen />;
  }
};

const Root = () => {
  const { session } = useSession();
  const { palette } = useTheme();
  if (session.status === 'loading') return <ActivityIndicator style={styles.fill} color={palette.primary} />;
  if (session.status === 'signedOut') return <AuthScreen expired={session.expired} />;
  return (
    // Foydalanuvchi almashsa holat noldan boshlanadi.
    <ChatStoreProvider key={session.user.id}>
      <NavigationProvider>
        <Screens />
        <PushNotifications />
        <CallOverlay />
      </NavigationProvider>
    </ChatStoreProvider>
  );
};

const Shell = ({ services }: { services?: Services }) => {
  const { scheme, palette } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: palette.surface }]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <SessionProvider services={services}>
        <Root />
      </SessionProvider>
    </SafeAreaView>
  );
};

/** `services` — faqat testlar uchun (soxta API/socket). */
export const App = ({ services }: { services?: Services }) => (
  <ErrorBoundary>
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell services={services} />
      </ThemeProvider>
    </SafeAreaProvider>
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
