import type { MessageStatus } from '@suhbat/core';
import { View } from 'react-native';
import { t } from '../i18n';
import { Icon } from './icon/Icon';

export type TickState = MessageStatus | 'pending' | 'failed';

interface Props {
  status: TickState;
  color:  string;
  /** O'qildi belgisi uchun boshqa rang (ixtiyoriy). */
  readColor?: string;
  dangerColor?: string;
  size?:  number;
}

const LABEL: Record<TickState, string> = {
  pending: t('chat.status.pending'),
  failed:  t('chat.status.failed'),
  sent:    t('chat.status.sent'),
  read:    t('chat.status.read'),
};

/** Holat: ⏱ yuborilmoqda, ! xato, ✓ yuborildi, ✓✓ o'qildi. */
export const StatusTick = ({ status, color, readColor, dangerColor = '#FF5252', size = 16 }: Props) => {
  const icon = status === 'pending' ? 'time-outline' : status === 'failed' ? 'alert-circle' : status === 'read' ? 'checkmark-done' : 'checkmark';
  const tint = status === 'failed' ? dangerColor : status === 'read' ? readColor ?? color : color;
  return (
    <View accessible accessibilityLabel={LABEL[status]} testID={`tick-${status}`}>
      <Icon name={icon} size={size} color={tint} />
    </View>
  );
};
