import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RecoveryCodesCard } from '../components/RecoveryCodesCard';
import { t } from '../i18n';
import { useSession } from '../state/SessionProvider';
import { radii, shadows, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

/** Ro'yxatdan o'tgandan keyin: tiklash kodlari (bir marta), so'ng ilova. */
export const RecoveryCodesScreen = ({ codes }: { codes: string[] }) => {
  const styles = useStyles(createStyles);
  const { acknowledgeRecoveryCodes } = useSession();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">{t('recovery.title')}</Text>
        <RecoveryCodesCard codes={codes} onDone={acknowledgeRecoveryCodes} />
      </View>
    </ScrollView>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: p.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  card:    { ...shadows.sm, width: '100%', maxWidth: 480, alignSelf: 'center', gap: space.md, padding: space.xl, borderRadius: radii.xl, backgroundColor: p.surface },
  title:   { ...textStyles.title, color: p.textPrimary, textAlign: 'center' },
});
