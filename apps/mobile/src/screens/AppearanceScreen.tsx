import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/icon/Icon';
import { ListRow } from '../components/ListRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { ACCENT_ORDER, ACCENTS } from '../theme/accents';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette, ThemeMode } from '../theme/ThemeProvider';
import { haptics } from '../utils/haptics';
import { MODE_LABEL } from './SettingsScreen';

const MODES: readonly { mode: ThemeMode; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline' }[] = [
  { mode: 'system', icon: 'phone-portrait-outline' },
  { mode: 'light',  icon: 'sunny-outline' },
  { mode: 'dark',   icon: 'moon-outline' },
];

/** Tema: yorug'/qorong'i/tizim va asosiy rang + jonli namuna. */
export const AppearanceScreen = () => {
  const styles = useStyles(createStyles);
  const { palette, scheme, mode, accent, setMode, setAccent } = useTheme();
  const { back } = useNavigation();

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('appearance.title')} onBack={back} />
      <ScrollView contentContainerStyle={styles.body}>
        <Section title={t('appearance.preview')}>
          <View style={styles.preview} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.bubble, styles.bubbleIn]}>
              <Text style={styles.textIn}>{t('appearance.sampleIn')}</Text>
            </View>
            <View style={[styles.bubble, styles.bubbleOut]}>
              <Text style={styles.textOut}>{t('appearance.sampleOut')}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>14:20</Text>
                <Icon name="checkmark-done" size={15} color={palette.readTick} />
              </View>
            </View>
          </View>
        </Section>

        <Section title={t('appearance.mode')} inset={56}>
          {MODES.map(({ mode: m, icon }) => (
            <ListRow
              key={m}
              title={MODE_LABEL[m]}
              icon={icon}
              role="radio"
              selected={mode === m}
              right={mode === m ? <Icon name="checkmark" size={22} color={palette.primary} /> : undefined}
              onPress={() => {
                haptics.selection();
                setMode(m);
              }}
            />
          ))}
        </Section>

        <Section title={t('appearance.accent')}>
          <View style={styles.accents} accessibilityRole="radiogroup">
            {ACCENT_ORDER.map((key) => {
              const color = scheme === 'dark' ? ACCENTS[key].dark : ACCENTS[key].light;
              const active = key === accent;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    haptics.selection();
                    setAccent(key);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={ACCENTS[key].label}
                  accessibilityState={{ selected: active }}
                  style={[styles.swatch, { backgroundColor: color }, active && { borderColor: palette.textPrimary }]}
                >
                  {active ? <Icon name="checkmark" size={22} color="#FFFFFF" /> : null}
                </Pressable>
              );
            })}
          </View>
        </Section>
      </ScrollView>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:      { flex: 1, backgroundColor: p.background },
  body:      { paddingBottom: space.xxxl },
  preview:   { padding: space.md, gap: space.sm, backgroundColor: p.chatBackground },
  bubble:    { maxWidth: '78%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radii.bubble },
  bubbleIn:  { alignSelf: 'flex-start', backgroundColor: p.bubbleOther, borderBottomLeftRadius: 5 },
  bubbleOut: { alignSelf: 'flex-end', backgroundColor: p.bubbleOwn, borderBottomRightRadius: 5 },
  textIn:    { ...textStyles.message, color: p.bubbleOtherText },
  textOut:   { ...textStyles.message, color: p.bubbleOwnText },
  meta:      { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 3 },
  metaText:  { ...textStyles.messageMeta, color: p.bubbleOwnMeta },
  accents:   { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, padding: space.lg, justifyContent: 'center' },
  swatch:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
});
