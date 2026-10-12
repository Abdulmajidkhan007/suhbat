import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, radius, spacing } from '@suhbat/ui-tokens';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';

/** "Yozmoqda" signali shu oraliqda yangilanadi (qabul qiluvchida 6 s da o'chadi). */
const TYPING_REFRESH_MS = 3_000;
const TYPING_IDLE_MS = 4_000;

interface Props {
  onSend:   (text: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export const Composer = ({ onSend, onTyping }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const [text, setText] = useState('');
  const lastSignal = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typingRef = useRef(onTyping);
  typingRef.current = onTyping;

  const stopTyping = () => {
    clearTimeout(idleTimer.current);
    if (lastSignal.current) typingRef.current(false);
    lastSignal.current = 0;
  };

  useEffect(() => () => {
    clearTimeout(idleTimer.current);
    if (lastSignal.current) typingRef.current(false);
  }, []);

  const onChange = (value: string) => {
    setText(value);
    if (!value.trim()) return stopTyping();
    const now = Date.now();
    if (now - lastSignal.current >= TYPING_REFRESH_MS) {
      lastSignal.current = now;
      onTyping(true);
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const send = () => {
    const value = text.trim();
    if (!value) return;
    stopTyping();
    setText('');
    onSend(value);
  };

  return (
    <View style={styles.root}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={onChange}
        placeholder="Xabar yozing..."
        placeholderTextColor={palette.textDisabled}
        multiline
        maxLength={4096}
        accessibilityLabel="Xabar matni"
      />
      <Pressable
        onPress={send}
        disabled={!text.trim()}
        style={[styles.send, !text.trim() && styles.sendDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Yuborish"
      >
        <Text style={styles.sendText}>➤</Text>
      </Pressable>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing(2),
    padding: spacing(2), backgroundColor: p.surface, borderTopWidth: 1, borderTopColor: p.divider,
  },
  input: {
    flex: 1, maxHeight: 120, minHeight: 40, paddingHorizontal: spacing(3), paddingVertical: spacing(2),
    borderRadius: radius.lg, backgroundColor: p.background, color: p.textPrimary, fontSize: fontSize.md,
  },
  send:         { width: 40, height: 40, borderRadius: radius.full, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  sendText:     { color: '#ffffff', fontSize: fontSize.lg },
});
