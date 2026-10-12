import type { PublicUser } from '@suhbat/core';
import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, radius, spacing } from '@suhbat/ui-tokens';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigation } from '../navigation/Navigator';
import { useChatStore } from '../state/ChatStoreProvider';
import { useSession } from '../state/SessionProvider';
import { useStyles, useTheme } from '../theme/ThemeProvider';

const SEARCH_DEBOUNCE_MS = 300;

export const NewChatScreen = () => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const { services: { api } } = useSession();
  const { openDirect } = useChatStore();
  const { back, replace } = useNavigation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      api.searchUsers(q).then(
        (users) => { if (!cancelled) { setResults(users); setError(null); } },
        () => { if (!cancelled) setError('Qidiruvda xato'); },
      ).finally(() => { if (!cancelled) setLoading(false); });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, query]);

  const open = async (user: PublicUser) => {
    try {
      const chat = await openDirect(user.id);
      replace({ name: 'chat', chatId: chat.id });
    } catch {
      setError('Chatni ochib bo\'lmadi');
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Yangi chat" onBack={back} />
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Ism yoki to'liq email"
        placeholderTextColor={palette.textDisabled}
        autoCapitalize="none"
        autoFocus
        accessibilityLabel="Foydalanuvchi qidirish"
      />
      {loading ? <ActivityIndicator style={styles.loader} color={palette.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => void open(item)} accessibilityRole="button">
            <Avatar name={item.displayName} size={40} />
            <Text style={styles.name}>{item.displayName}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          query.trim() && !loading ? <Text style={styles.empty}>Hech kim topilmadi</Text> : undefined
        }
      />
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: p.surface },
  input:  { margin: spacing(3), paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), borderRadius: radius.md, backgroundColor: p.background, color: p.textPrimary, fontSize: fontSize.md },
  loader: { marginVertical: spacing(2) },
  item:   { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(2.5) },
  name:   { fontSize: fontSize.md, color: p.textPrimary },
  empty:  { padding: spacing(6), textAlign: 'center', color: p.textSecondary },
  error:  { paddingHorizontal: spacing(4), color: p.danger },
});
