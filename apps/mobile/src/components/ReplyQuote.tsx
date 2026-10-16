import type { MessageReply } from '@suhbat/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { avatarColor, replyText } from '../utils/format';

interface Props {
  reply:    MessageReply;
  /** Asl xabar muallifi ismi (a'zolar ro'yxatidan). */
  name:     string;
  /** Matn rangi (pufak ichida — pufak matni rangi). */
  textColor: string;
  /** Bosilganda asl xabarga o'tish; o'chirilgan bo'lsa — yo'q. */
  onPress?: (messageId: string) => void;
}

/** Javob berilgan xabar bloki: chap chiziq, muallif ismi, matn boshi yoki "O'chirilgan xabar". */
export const ReplyQuote = ({ reply, name, textColor, onPress }: Props) => {
  const accent = avatarColor(reply.senderId);
  const text = replyText(reply);
  const press = !reply.deleted && onPress ? () => onPress(reply.id) : undefined;
  return (
    <Pressable
      onPress={press}
      disabled={!press}
      accessibilityRole={press ? 'button' : undefined}
      accessibilityLabel={`${t('reply.to', { name })}: ${text}`}
      accessibilityHint={press ? t('reply.jump') : undefined}
      style={[styles.root, { borderLeftColor: accent, backgroundColor: `${accent}22` }]}
    >
      <Text style={[styles.name, { color: accent }]} numberOfLines={1}>{name}</Text>
      <View>
        <Text style={[styles.text, { color: textColor }, reply.deleted && styles.deleted]} numberOfLines={1}>{text}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root:    { borderLeftWidth: 3, borderRadius: radii.xs + 2, paddingLeft: space.sm, paddingRight: space.sm, paddingVertical: 3, marginBottom: space.xs, minWidth: 120 },
  name:    { ...textStyles.bodySmall, fontWeight: '600' },
  text:    { ...textStyles.bodySmall, opacity: 0.9 },
  deleted: { fontStyle: 'italic', opacity: 0.7 },
});
