import type { MessageStatus } from '@suhbat/core';
import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, radius, spacing } from '@suhbat/ui-tokens';
import { memo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LocalMessage } from '../state/chatState';
import { useStyles } from '../theme/ThemeProvider';
import { formatTime, messagePreview } from '../utils/format';

interface Props {
  message:     LocalMessage;
  own:         boolean;
  status:      MessageStatus;
  senderName?: string;
  onRetry?:    (message: LocalMessage) => void;
}

/** Holat belgisi: kutilmoqda ⏱, xato !, yuborildi ✓, o'qildi ✓✓. */
export const statusMark = (message: LocalMessage, status: MessageStatus): string => {
  if (message.local === 'pending') return '⏱';
  if (message.local === 'failed') return '!';
  return status === 'read' ? '✓✓' : '✓';
};

export const MessageBubble = memo(({ message, own, status, senderName, onRetry }: Props) => {
  const styles = useStyles(createStyles);
  const failed = message.local === 'failed';
  const attachment = message.attachment;

  if (message.type === 'system') {
    // Tizim xabari (qo'ng'iroq natijasi) — markazda, pufakchasiz.
    return (
      <View style={styles.systemRow} accessibilityRole="text">
        <Text style={styles.system}>{message.content} · {formatTime(message.createdAt)}</Text>
      </View>
    );
  }

  const onPress = failed
    ? () => onRetry?.(message)
    : attachment
      ? () => void Linking.openURL(attachment.url)
      : undefined;

  return (
    <View style={[styles.row, own && styles.rowOwn]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={[styles.bubble, own ? styles.own : styles.other]}
        accessibilityHint={failed ? 'Qayta yuborish uchun bosing' : undefined}
      >
        {senderName && !own ? <Text style={styles.sender}>{senderName}</Text> : null}
        {attachment ? (
          <Text style={[styles.text, own && styles.textOwn, styles.link]}>{messagePreview({ ...message, content: '' })}</Text>
        ) : null}
        {message.content ? <Text style={[styles.text, own && styles.textOwn]}>{message.content}</Text> : null}
        <Text style={[styles.meta, own && styles.metaOwn, failed && styles.failed]}>
          {message.editedAt ? 'tahrirlangan · ' : ''}
          {formatTime(message.createdAt)}
          {own ? ` ${statusMark(message, status)}` : ''}
          {failed ? ' Yuborilmadi — qayta urinish' : ''}
        </Text>
      </Pressable>
    </View>
  );
});

const createStyles = (p: Palette) => StyleSheet.create({
  systemRow: { alignItems: 'center', marginVertical: spacing(1) },
  system: {
    fontSize: fontSize.xs, color: p.textSecondary, backgroundColor: p.surface,
    paddingHorizontal: spacing(3), paddingVertical: spacing(1), borderRadius: radius.full, overflow: 'hidden',
  },
  row:     { flexDirection: 'row', paddingHorizontal: spacing(3), paddingVertical: spacing(0.5) },
  rowOwn:  { justifyContent: 'flex-end' },
  bubble:  { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing(3), paddingVertical: spacing(2) },
  own:     { backgroundColor: p.bubbleOwn, borderBottomRightRadius: radius.sm },
  other:   { backgroundColor: p.bubbleOther, borderBottomLeftRadius: radius.sm },
  sender:  { color: p.primary, fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing(0.5) },
  text:    { color: p.textPrimary, fontSize: fontSize.md },
  textOwn: { color: p.bubbleOwnText },
  link:    { textDecorationLine: 'underline' },
  meta:    { color: p.textSecondary, fontSize: fontSize.xs, alignSelf: 'flex-end', marginTop: spacing(1) },
  metaOwn: { color: 'rgba(255,255,255,0.8)' },
  failed:  { color: p.danger },
});
