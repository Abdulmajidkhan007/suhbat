import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { Icon } from './icon/Icon';
import type { IconName } from './icon/Icon';

export interface SheetAction {
  key:          string;
  label:        string;
  icon:         IconName;
  onPress:      () => void;
  destructive?: boolean;
}

interface Props {
  visible:   boolean;
  title?:    string;
  /** Sarlavha ostidagi qisqa matn (masalan, xabar boshlanishi). */
  preview?:  string;
  actions:   readonly SheetAction[];
  onClose:   () => void;
}

/** Pastdan chiquvchi amallar menyusi (uzun bosish, "Yangi"). */
export const ActionSheet = ({ visible, title, preview, actions, onClose }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, bounciness: 4, speed: 18 }).start();
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + space.sm, transform: [{ translateY }] }]}
        accessibilityViewIsModal
      >
        <View style={styles.handle} />
        {title ? <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text> : null}
        {preview ? <Text style={styles.preview} numberOfLines={2}>{preview}</Text> : null}
        {actions.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => {
              onClose();
              a.onPress();
            }}
            accessibilityRole="button"
            android_ripple={{ color: palette.surfaceHighlight }}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Icon name={a.icon} size={22} color={a.destructive ? palette.danger : palette.textSecondary} />
            <Text style={[styles.label, a.destructive && styles.destructive]}>{a.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFill, backgroundColor: p.overlay },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.sm,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: p.surfaceElevated,
  },
  handle:      { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.divider, marginBottom: space.sm },
  title:       { ...textStyles.heading, color: p.textPrimary, paddingHorizontal: space.xl, paddingTop: space.xs },
  preview:     { ...textStyles.bodySmall, color: p.textSecondary, paddingHorizontal: space.xl, paddingBottom: space.sm },
  action:      { flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 52, paddingHorizontal: space.xl },
  pressed:     { backgroundColor: p.surfaceHighlight },
  label:       { ...textStyles.body, fontSize: 16, color: p.textPrimary },
  destructive: { color: p.danger },
});
