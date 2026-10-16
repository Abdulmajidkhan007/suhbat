import type { MessageStatus } from '@suhbat/core';
import { memo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import type { LocalMessage } from '../state/chatState';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { avatarColor, formatTime, messagePreview } from '../utils/format';
import { Icon } from './icon/Icon';
import { StatusTick } from './StatusTick';
import type { TickState } from './StatusTick';

interface Props {
  message:      LocalMessage;
  own:          boolean;
  status:       MessageStatus;
  senderName?:  string;
  /** Ketma-ket bir xil yuboruvchi xabarlarining oxirgisi — "dum" bilan. */
  tail?:        boolean;
  onRetry?:     (message: LocalMessage) => void;
  onLongPress?: (message: LocalMessage) => void;
}

export const tickState = (message: LocalMessage, status: MessageStatus): TickState =>
  message.local ?? status;

export const MessageBubble = memo(({ message, own, status, senderName, tail = true, onRetry, onLongPress }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const failed = message.local === 'failed';
  const attachment = message.attachment;

  if (message.type === 'system') {
    // Tizim xabari (qo'ng'iroq natijasi) — markazda, pufakchasiz.
    return (
      <View style={styles.systemRow}>
        <Text style={styles.system}>{message.content} · {formatTime(message.createdAt)}</Text>
      </View>
    );
  }

  const onPress = failed
    ? () => onRetry?.(message)
    : attachment
      ? () => void Linking.openURL(attachment.url).catch(() => undefined)
      : undefined;

  const metaColor = own ? palette.bubbleOwnMeta : palette.bubbleOtherMeta;
  const time = formatTime(message.createdAt);
  const tick = tickState(message, status);
  const label = [
    own ? t('common.you') : senderName,
    attachment ? messagePreview({ ...message, content: '' }) : null,
    message.content,
    message.editedAt ? t('chat.edited') : null,
    time,
    own ? t(`chat.status.${tick}`) : null,
  ].filter(Boolean).join(', ');

  return (
    <View style={[styles.row, own && styles.rowOwn, !tail && styles.rowGrouped]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress ? () => onLongPress(message) : undefined}
        delayLongPress={300}
        style={({ pressed }) => [
          styles.bubble,
          own ? styles.own : styles.other,
          tail && (own ? styles.tailOwn : styles.tailOther),
          pressed && styles.pressed,
        ]}
        accessibilityLabel={label}
        accessibilityHint={failed ? t('chat.failed') : attachment ? t('chat.openFile') : undefined}
        accessibilityActions={onLongPress ? [{ name: 'longpress', label: t('menu.title') }] : undefined}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onLongPress?.(message);
        }}
      >
        {senderName && !own ? (
          <Text style={[styles.sender, { color: avatarColor(message.senderId) }]} numberOfLines={1}>{senderName}</Text>
        ) : null}
        {attachment ? (
          <View style={styles.attachment}>
            <View style={[styles.fileIcon, { backgroundColor: palette.primary }]}>
              <Icon
                name={attachment.kind === 'image' ? 'image-outline' : attachment.kind === 'voice' ? 'mic-outline' : 'document-outline'}
                size={20}
                color={palette.onPrimary}
              />
            </View>
            <Text style={[styles.text, own ? styles.textOwn : styles.textOther, styles.fileName]} numberOfLines={2}>
              {messagePreview({ ...message, content: '' })}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.text, own ? styles.textOwn : styles.textOther]}>
          {message.content}
          {/* Vaqt joyi: matnning oxirgi qatori meta bilan ustma-ust tushmasin. */}
          <Text style={styles.spacer}>{`${message.editedAt ? '        ' : ''}            ${own ? '   ' : ''}`}</Text>
        </Text>
        <View style={styles.meta}>
          {message.editedAt ? <Text style={[styles.metaText, { color: metaColor }]}>{t('chat.edited')}</Text> : null}
          <Text style={[styles.metaText, { color: metaColor }]}>{time}</Text>
          {own ? <StatusTick status={tick} color={metaColor} readColor={palette.readTick} dangerColor={palette.danger} size={15} /> : null}
        </View>
        {failed ? <Text style={styles.failed}>{t('chat.failed')}</Text> : null}
      </Pressable>
    </View>
  );
});

const createStyles = (p: Palette) => StyleSheet.create({
  systemRow:  { alignItems: 'center', marginVertical: space.xs, paddingHorizontal: space.lg },
  system: {
    ...textStyles.bodySmall, color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.35)', textAlign: 'center',
    paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radii.full, overflow: 'hidden',
  },
  row:        { flexDirection: 'row', paddingHorizontal: space.sm, marginTop: space.xs },
  rowGrouped: { marginTop: 2 },
  rowOwn:     { justifyContent: 'flex-end' },
  bubble:     { maxWidth: '82%', minWidth: 72, borderRadius: radii.bubble, paddingHorizontal: space.md, paddingTop: 6, paddingBottom: 6 },
  own:        { backgroundColor: p.bubbleOwn },
  other:      { backgroundColor: p.bubbleOther },
  tailOwn:    { borderBottomRightRadius: 5 },
  tailOther:  { borderBottomLeftRadius: 5 },
  pressed:    { opacity: 0.85 },
  sender:     { ...textStyles.bodySmall, fontWeight: '600', marginBottom: 2 },
  text:       { ...textStyles.message },
  textOwn:    { color: p.bubbleOwnText },
  textOther:  { color: p.bubbleOtherText },
  spacer:     { fontSize: 12 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  fileIcon:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fileName:   { flex: 1, textDecorationLine: 'underline' },
  meta:       { position: 'absolute', right: space.sm + 2, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:   { ...textStyles.messageMeta },
  failed:     { ...textStyles.caption, color: p.danger, marginTop: space.xs, marginBottom: space.md },
});
