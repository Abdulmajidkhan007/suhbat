import Clipboard from '@react-native-clipboard/clipboard';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { t } from '../i18n';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { haptics } from '../utils/haptics';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  codes:      string[];
  onDone:     () => void;
  doneLabel?: string;
}

/**
 * Parolni tiklash kodlari — faqat shu yerda bir marta ko'rinadi (serverda faqat hash).
 * Nusxa olish, ulashish (fayl/eslatmaga saqlash) va "saqladim" tasdig'isiz davom etib bo'lmaydi.
 */
export const RecoveryCodesCard = ({ codes, onDone, doneLabel = t('recovery.continue') }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = [t('recovery.fileTitle'), '', ...codes].join('\n');

  const copy = () => {
    Clipboard.setString(codes.join('\n'));
    haptics.success();
    setCopied(true);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>{t('recovery.intro')}</Text>
      <View style={styles.grid} accessibilityLabel={t('recovery.title')}>
        {codes.map((c) => <Text key={c} style={styles.code} selectable>{c}</Text>)}
      </View>
      <View style={styles.row}>
        <Pressable style={styles.secondary} onPress={copy} accessibilityRole="button">
          <Text style={styles.secondaryText}>{copied ? t('recovery.copied') : t('recovery.copy')}</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={() => void Share.share({ message: text, title: t('recovery.title') }).catch(() => undefined)}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{t('recovery.share')}</Text>
        </Pressable>
      </View>
      <Pressable style={styles.confirm} onPress={() => setSaved((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: saved }}>
        <Text style={styles.confirmText}>{t('recovery.saved')}</Text>
        <Switch
          value={saved}
          onValueChange={setSaved}
          trackColor={{ true: palette.primary, false: palette.divider }}
          accessibilityLabel={t('recovery.saved')}
        />
      </Pressable>
      <PrimaryButton label={doneLabel} onPress={onDone} disabled={!saved} />
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:          { gap: space.md },
  intro:         { ...textStyles.bodySmall, color: p.textSecondary },
  grid:          {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm,
    padding: space.md, borderRadius: radii.md, backgroundColor: p.surfaceHighlight,
  },
  code:          { ...textStyles.body, width: '48%', textAlign: 'center', fontFamily: 'monospace', color: p.textPrimary },
  row:           { flexDirection: 'row', gap: space.sm },
  secondary:     {
    flex: 1, minHeight: 44, borderRadius: radii.md, borderWidth: 1, borderColor: p.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm,
  },
  secondaryText: { ...textStyles.button, color: p.primary },
  confirm:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  confirmText:   { ...textStyles.body, flex: 1, color: p.textPrimary },
});
