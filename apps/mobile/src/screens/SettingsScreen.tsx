import { useEffect, useState } from 'react';
import { Alert, AppState, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { ListRow } from '../components/ListRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { APP_VERSION } from '../config/version';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { useCurrentUser, useSession } from '../state/SessionProvider';
import { ACCENTS } from '../theme/accents';
import { space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette, ThemeMode } from '../theme/ThemeProvider';

export const MODE_LABEL: Record<ThemeMode, string> = {
  system: t('appearance.system'),
  light:  t('appearance.light'),
  dark:   t('appearance.dark'),
};

export const SettingsScreen = () => {
  const styles = useStyles(createStyles);
  const { palette, mode, accent } = useTheme();
  const me = useCurrentUser();
  const { logout, services: { api, background } } = useSession();
  const { push } = useNavigation();
  const [preview, setPreview] = useState<boolean | null>(null);
  const keepAlive = useKeepAlive();

  useEffect(() => {
    let cancelled = false;
    api.getNotificationSettings().then(
      (s) => { if (!cancelled) setPreview(s.preview); },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  const togglePreview = (value: boolean) => {
    const prev = preview;
    setPreview(value);
    api.updateNotificationSettings({ preview: value }).then(
      (s) => setPreview(s.preview),
      () => {
        setPreview(prev);
        Alert.alert(t('common.error'), t('settings.previewError'));
      },
    );
  };

  const confirmLogout = () => Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('settings.logout'), style: 'destructive', onPress: () => void logout() },
  ]);

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('settings.title')} large />
      <ScrollView contentContainerStyle={styles.body}>
        <Section>
          <ListRow
            title={me.displayName}
            subtitle={me.bio || me.email}
            left={<Avatar name={me.displayName} seed={me.id} size={64} />}
            onPress={() => push({ name: 'profile' })}
            accessibilityLabel={t('settings.profile')}
            accessibilityHint={t('settings.editProfile')}
            chevron
          />
        </Section>

        <Section inset={58}>
          <ListRow
            title={t('settings.editProfile')}
            icon="person-outline"
            iconColor="#3390EC"
            onPress={() => push({ name: 'profile' })}
            chevron
          />
          <ListRow
            title={t('settings.appearance')}
            value={`${MODE_LABEL[mode]} · ${ACCENTS[accent].label}`}
            icon="color-palette-outline"
            iconColor="#A07CE8"
            onPress={() => push({ name: 'appearance' })}
            chevron
          />
        </Section>

        <Section title={t('settings.notifications')} footer={t('settings.previewHint')} inset={58}>
          <ListRow
            title={t('settings.preview')}
            icon="notifications-outline"
            iconColor="#E86B6B"
            right={
              <Switch
                value={preview ?? true}
                disabled={preview === null}
                onValueChange={togglePreview}
                trackColor={{ true: palette.primary, false: palette.divider }}
                accessibilityLabel={t('settings.preview')}
              />
            }
          />
        </Section>

        {keepAlive.available && (
          <Section footer={t('settings.keepAliveHint')} inset={58}>
            <ListRow
              title={t('settings.keepAlive')}
              icon="globe-outline"
              iconColor="#3FB37F"
              right={
                <Switch
                  value={keepAlive.enabled ?? false}
                  disabled={keepAlive.enabled === null}
                  onValueChange={keepAlive.toggle}
                  trackColor={{ true: palette.primary, false: palette.divider }}
                  accessibilityLabel={t('settings.keepAlive')}
                />
              }
            />
            {keepAlive.enabled && keepAlive.batteryRestricted && (
              <ListRow
                title={t('settings.battery')}
                subtitle={t('settings.batteryHint')}
                icon="shield-checkmark-outline"
                iconColor="#E8A23C"
                onPress={background.native.requestIgnoreBatteryOptimizations}
                chevron
              />
            )}
          </Section>
        )}

        <Section inset={58}>
          <ListRow title={t('settings.logout')} icon="log-out-outline" destructive onPress={confirmLogout} />
        </Section>

        <Text style={styles.version}>{t('settings.version', { version: APP_VERSION })}</Text>
      </ScrollView>
    </View>
  );
};

/** Android: fonda ulanib turish (foreground service) va batareya optimizatsiyasi holati. */
const useKeepAlive = () => {
  const { services: { background } } = useSession();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [batteryRestricted, setBatteryRestricted] = useState(false);

  useEffect(() => {
    if (!background.available) return;
    let cancelled = false;
    const refresh = () => {
      background.isEnabled().then((v) => { if (!cancelled) setEnabled(v); }, () => undefined);
      background.native.isIgnoringBatteryOptimizations().then(
        (ignoring) => { if (!cancelled) setBatteryRestricted(!ignoring); },
        () => undefined,
      );
    };
    refresh();
    // Tizim sozlamasidan qaytganda (batareya oynasi) yangilanadi.
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [background]);

  const toggle = (value: boolean) => {
    setEnabled(value);
    background.setEnabled(value).then(
      async () => {
        if (value && !(await background.native.isIgnoringBatteryOptimizations())) {
          background.native.requestIgnoreBatteryOptimizations();
        }
      },
      () => {
        setEnabled(!value);
        Alert.alert(t('common.error'), t('settings.keepAliveError'));
      },
    );
  };

  return { available: background.available, enabled, batteryRestricted, toggle };
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: p.background },
  body:    { paddingBottom: space.xxxl },
  version: { ...textStyles.caption, color: p.textSecondary, textAlign: 'center', marginTop: space.xl },
});
