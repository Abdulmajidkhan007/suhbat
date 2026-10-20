import { useMemo } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BackgroundBridge } from './background/BackgroundBridge';
import { CallOverlay } from './calls/CallOverlay';
import { LoadingState } from './components/EmptyState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TabBar } from './components/TabBar';
import { NavigationProvider, useNavigation } from './navigation/Navigator';
import { ScreenTransition } from './navigation/ScreenTransition';
import { PushNotifications } from './push/PushNotifications';
import { AddMembersScreen } from './screens/AddMembersScreen';
import { AppearanceScreen } from './screens/AppearanceScreen';
import { AuthScreen } from './screens/AuthScreen';
import { ChatInfoScreen } from './screens/ChatInfoScreen';
import { ChatListScreen } from './screens/ChatListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { NewChatScreen } from './screens/NewChatScreen';
import { NewGroupScreen } from './screens/NewGroupScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RecoveryCodesScreen } from './screens/RecoveryCodesScreen';
import { SecurityScreen } from './screens/SecurityScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { Services } from './services/createServices';
import { ChatStoreProvider, useChatStore } from './state/ChatStoreProvider';
import { SessionProvider, useSession } from './state/SessionProvider';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import type { PrefsStorage } from './services/prefsStorage';

const Tabs = () => {
  const { tab, setTab } = useNavigation();
  const { state } = useChatStore();
  const unread = useMemo(
    () => Object.values(state.chats).reduce((sum, c) => sum + (c.unreadCount > 0 ? 1 : 0), 0),
    [state.chats],
  );
  return (
    <View style={styles.fill}>
      <View style={styles.fill}>{tab === 'chats' ? <ChatListScreen /> : <SettingsScreen />}</View>
      <TabBar current={tab} onSelect={setTab} unread={unread} />
    </View>
  );
};

const Screens = () => {
  const { route, depth } = useNavigation();
  const screen = (() => {
    switch (route.name) {
      case 'tabs':       return <Tabs />;
      case 'chat':       return <ChatScreen key={route.chatId} chatId={route.chatId} />;
      case 'chatInfo':   return <ChatInfoScreen chatId={route.chatId} />;
      case 'addMembers': return <AddMembersScreen chatId={route.chatId} />;
      case 'newChat':    return <NewChatScreen />;
      case 'newGroup':   return <NewGroupScreen kind={route.kind} />;
      case 'profile':    return <ProfileScreen />;
      case 'appearance': return <AppearanceScreen />;
      case 'security':   return <SecurityScreen />;
    }
  })();
  // Har yangi ekran o'tish animatsiyasi bilan; tablarga qaytish — animatsiyasiz.
  return (
    <ScreenTransition key={`${depth}:${route.name}`} animate={route.name !== 'tabs'}>
      {screen}
    </ScreenTransition>
  );
};

const Root = () => {
  const { session, recoveryCodes } = useSession();
  if (session.status === 'loading') return <LoadingState />;
  if (session.status === 'signedOut') return <AuthScreen expired={session.expired} />;
  if (recoveryCodes) return <RecoveryCodesScreen codes={recoveryCodes} />;
  return (
    // Foydalanuvchi almashsa holat noldan boshlanadi.
    <ChatStoreProvider key={session.user.id}>
      <NavigationProvider>
        <Screens />
        <PushNotifications />
        <BackgroundBridge />
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

interface AppProps {
  /** Faqat testlar uchun (soxta API/socket). */
  services?: Services;
  /** Faqat testlar uchun (tema sozlamasi). */
  prefs?:    PrefsStorage;
}

export const App = ({ services, prefs }: AppProps) => (
  <ErrorBoundary>
    <SafeAreaProvider>
      <ThemeProvider storage={prefs}>
        <Shell services={services} />
      </ThemeProvider>
    </SafeAreaProvider>
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
