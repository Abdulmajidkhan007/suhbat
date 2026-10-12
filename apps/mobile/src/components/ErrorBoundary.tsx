import { fontSize, palettes, radius, spacing } from '@suhbat/ui-tokens';
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Appearance, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Crash ekrani: render xatosi butun ilovani oq ekranga aylantirmaydi.
 * Provayderlardan tashqarida turadi — shuning uchun mavzuni o'zi aniqlaydi.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const p = palettes[Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'];
    return (
      <View style={[styles.root, { backgroundColor: p.background }]} accessibilityRole="alert">
        <Text style={[styles.title, { color: p.textPrimary }]}>Nimadir noto'g'ri ketdi</Text>
        <Text style={[styles.body, { color: p.textSecondary }]}>
          Ilovada kutilmagan xato yuz berdi. Qayta urinib ko'ring.
        </Text>
        {__DEV__ && <Text style={[styles.details, { color: p.danger }]}>{error.message}</Text>}
        <Pressable
          onPress={this.reset}
          style={[styles.button, { backgroundColor: p.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Qayta urinish</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(6), gap: spacing(3) },
  title:      { fontSize: fontSize.xl, fontWeight: '700', textAlign: 'center' },
  body:       { fontSize: fontSize.md, textAlign: 'center' },
  details:    { fontSize: fontSize.xs, textAlign: 'center' },
  button:     { marginTop: spacing(2), paddingHorizontal: spacing(6), paddingVertical: spacing(3), borderRadius: radius.md },
  buttonText: { color: '#ffffff', fontSize: fontSize.md, fontWeight: '600' },
});
