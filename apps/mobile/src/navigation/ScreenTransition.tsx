import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

/** Yangi ekran o'ngdan suriladi (native driver). "Harakatni kamaytirish" yoqilgan bo'lsa — animatsiyasiz. */
export const ScreenTransition = ({ children, animate }: { children: ReactNode; animate: boolean }) => {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) progress.setValue(1);
      else Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }, () => progress.setValue(1));
    return () => {
      cancelled = true;
    };
  }, [animate, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [48, 0] });
  return (
    <Animated.View style={[styles.fill, { opacity: progress, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
