import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import type { TabName } from '../navigation/Navigator';
import { space } from '../theme/metrics';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { haptics } from '../utils/haptics';
import { Icon } from './icon/Icon';
import type { IconName } from './icon/Icon';

const TABS: readonly { name: TabName; label: string; icon: IconName; active: IconName }[] = [
  { name: 'chats',    label: t('tabs.chats'),    icon: 'chatbubbles-outline', active: 'chatbubbles' },
  { name: 'settings', label: t('tabs.settings'), icon: 'settings-outline',    active: 'settings' },
];

interface Props {
  current:  TabName;
  onSelect: (tab: TabName) => void;
  /** Suhbatlar tabidagi o'qilmaganlar soni. */
  unread:   number;
}

export const TabBar = ({ current, onSelect, unread }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  return (
    <View style={styles.root} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = tab.name === current;
        const color = active ? palette.primary : palette.tabBarInactive;
        const badge = tab.name === 'chats' && unread > 0;
        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => {
              if (!active) haptics.selection();
              onSelect(tab.name);
            }}
            accessibilityRole="tab"
            accessibilityLabel={badge ? `${tab.label}, ${t('list.unread', { n: unread })}` : tab.label}
            accessibilityState={{ selected: active }}
          >
            <View>
              <Icon name={active ? tab.active : tab.icon} size={26} color={color} />
              {badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:      { flexDirection: 'row', backgroundColor: p.tabBar, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
  tab:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xs + 2, gap: 2, minHeight: 52 },
  label:     { fontSize: 11, fontWeight: '500' },
  badge: {
    position: 'absolute', top: -4, right: -12, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: p.danger,
    borderWidth: 1.5, borderColor: p.tabBar,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
