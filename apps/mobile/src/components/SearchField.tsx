import { StyleSheet, TextInput, View } from 'react-native';
import { t } from '../i18n';
import { radii, space } from '../theme/metrics';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { Icon } from './icon/Icon';
import { IconButton } from './IconButton';

interface Props {
  value:        string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  label?:       string;
  autoFocus?:   boolean;
}

export const SearchField = ({ value, onChangeText, placeholder = t('common.search'), label = t('common.search'), autoFocus }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  return (
    <View style={styles.root}>
      <Icon name="search" size={18} color={palette.textSecondary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        accessibilityLabel={label}
      />
      {value ? <IconButton icon="close" label={t('common.close')} onPress={() => onChangeText('')} size={18} color={palette.textSecondary} /> : null}
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 40,
    marginHorizontal: space.md, marginVertical: space.sm, paddingLeft: space.md,
    borderRadius: radii.full, backgroundColor: p.surfaceHighlight,
  },
  input: { flex: 1, height: 40, paddingVertical: 0, color: p.textPrimary, fontSize: 16 },
});
