import { StyleSheet, Text, View } from 'react-native';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';

/** Chatdagi sana ajratgichi ("Bugun", "Kecha", "12-oktabr"). */
export const DateSeparator = ({ label }: { label: string }) => (
  <View style={styles.root} accessibilityRole="header">
    <Text style={styles.text}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { alignItems: 'center', marginVertical: space.sm },
  text: {
    ...textStyles.bodySmall, fontWeight: '500', color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: space.md, paddingVertical: 3, borderRadius: radii.full, overflow: 'hidden',
  },
});
