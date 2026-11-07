import { DEFAULT_PRIVACY_RETENTION_DAYS, privacySections } from '@suhbat/core';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { useSession } from '../state/SessionProvider';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

/** Sozlamalar → Maxfiylik: qaysi ma'lumotlar yoziladi, qancha saqlanadi, xabar matni o'qilmasligi (matn veb bilan bir xil). */
export const PrivacyScreen = () => {
  const styles = useStyles(createStyles);
  const { services: { api } } = useSession();
  const { back } = useNavigation();
  const [days, setDays] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getPrivacyInfo().then(
      (i) => { if (!cancelled) setDays(i.retentionDays); },
      () => { if (!cancelled) setFailed(true); },
    );
    return () => { cancelled = true; };
  }, [api]);

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('privacy.title')} onBack={back} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>{t('privacy.intro')}</Text>
        {failed ? <Text style={styles.warn}>{t('privacy.defaultDays')}</Text> : null}
        {privacySections(days ?? DEFAULT_PRIVACY_RETENTION_DAYS).map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.heading} accessibilityRole="header">{s.title}</Text>
            {s.items.map((it) => <Text key={it} style={styles.item}>{'• '}{it}</Text>)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: p.background },
  body:    { padding: space.lg, gap: space.lg },
  card:    { backgroundColor: p.surface, borderRadius: radii.md, padding: space.lg, gap: space.sm },
  heading: { ...textStyles.body, fontWeight: '600', color: p.textPrimary },
  item:    { ...textStyles.bodySmall, color: p.textPrimary },
  hint:    { ...textStyles.bodySmall, color: p.textSecondary },
  warn:    { ...textStyles.bodySmall, color: p.danger },
});
