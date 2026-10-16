import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { t } from '../i18n';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { haptics } from '../utils/haptics';
import { Icon } from './icon/Icon';
import { IconButton } from './IconButton';

/** "Yozmoqda" signali shu oraliqda yangilanadi (qabul qiluvchida 6 s da o'chadi). */
const TYPING_REFRESH_MS = 3_000;
const TYPING_IDLE_MS = 4_000;
const MAX_LENGTH = 4096;

export interface EditTarget {
  id:      string;
  content: string;
}

interface Props {
  onSend:   (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  /** Tahrirlanayotgan xabar — matn maydoniga qo'yiladi, yuborish tahrirni saqlaydi. */
  editing?:      EditTarget | null;
  onEdit?:       (target: EditTarget, text: string) => void;
  onCancelEdit?: () => void;
}

export const Composer = ({ onSend, onTyping, editing = null, onEdit, onCancelEdit }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const [text, setText] = useState('');
  const draftRef = useRef('');
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

  // Tahrir boshlanganda — xabar matni; tugaganda — oldingi qoralama qaytadi.
  const editingId = editing?.id ?? null;
  const editingContent = editing?.content ?? '';
  useEffect(() => {
    if (editingId) {
      setText((current) => {
        draftRef.current = current;
        return editingContent;
      });
    } else {
      setText(draftRef.current);
      draftRef.current = '';
    }
  }, [editingId, editingContent]);

  const onChange = (value: string) => {
    setText(value);
    if (editing) return; // tahrir paytida "yozmoqda" yuborilmaydi
    if (!value.trim()) return stopTyping();
    const now = Date.now();
    if (now - lastSignal.current >= TYPING_REFRESH_MS) {
      lastSignal.current = now;
      onTyping(true);
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const value = text.trim();
  const unchanged = editing !== null && value === editing.content.trim();
  const canSend = value.length > 0 && !unchanged;

  const send = () => {
    if (!canSend) return;
    haptics.light();
    if (editing) {
      onEdit?.(editing, value);
      return;
    }
    stopTyping();
    setText('');
    onSend(value);
  };

  return (
    <View style={styles.wrap}>
      {editing ? (
        <View style={styles.editBar}>
          <Icon name="pencil" size={20} color={palette.primary} />
          <View style={styles.editBody}>
            <Text style={styles.editTitle}>{t('composer.editing')}</Text>
            <Text style={styles.editText} numberOfLines={1}>{editing.content}</Text>
          </View>
          <IconButton icon="close" label={t('composer.cancelEdit')} onPress={() => onCancelEdit?.()} color={palette.textSecondary} size={20} />
        </View>
      ) : null}
      <View style={styles.root}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChange}
          placeholder={t('composer.placeholder')}
          placeholderTextColor={palette.textSecondary}
          multiline
          maxLength={MAX_LENGTH}
          accessibilityLabel={t('composer.label')}
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && styles.sendPressed]}
          accessibilityRole="button"
          accessibilityLabel={editing ? t('common.save') : t('composer.send')}
          accessibilityState={{ disabled: !canSend }}
        >
          <Icon name={editing ? 'checkmark' : 'send'} size={20} color={palette.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  wrap:      { backgroundColor: p.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
  root:      { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.sm },
  input: {
    ...textStyles.body, fontSize: 16, flex: 1, maxHeight: 140, minHeight: 40,
    paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 10,
    borderRadius: radii.xl, backgroundColor: p.surfaceHighlight, color: p.textPrimary,
  },
  send:         { width: 40, height: 40, borderRadius: 20, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  sendPressed:  { opacity: 0.8 },
  editBar:      { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, paddingTop: space.xs },
  editBody:     { flex: 1, borderLeftWidth: 2, borderLeftColor: p.primary, paddingLeft: space.sm },
  editTitle:    { ...textStyles.bodySmall, fontWeight: '600', color: p.primary },
  editText:     { ...textStyles.bodySmall, color: p.textSecondary },
});
