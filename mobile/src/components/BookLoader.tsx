import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { colors } from '../theme';

export function BookLoader({ label = 'Loading recipes', progress }: { label?: string; progress?: number }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [p]);

  const pulse = p.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const lift = p.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const pct = progress === undefined ? null : Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }}>
      <Animated.View style={{ opacity: pulse, transform: [{ translateY: lift }] }}>
        <View style={{ width: 190, height: 140, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: 22, left: 6, width: 178, height: 104, borderRadius: 14, backgroundColor: colors.accent, opacity: 0.16 }} />
          <View
            style={{
              width: 168,
              height: 100,
              borderRadius: 14,
              backgroundColor: colors.card,
              borderWidth: 1.5,
              borderColor: colors.accent,
              overflow: 'hidden',
              padding: 14,
            }}
          >
            <View style={{ width: '70%', height: 7, borderRadius: 4, backgroundColor: colors.accentSoft, marginBottom: 8 }} />
            <View style={{ width: '55%', height: 7, borderRadius: 4, backgroundColor: colors.accentSoft, marginBottom: 8 }} />
            <View style={{ width: '64%', height: 7, borderRadius: 4, backgroundColor: colors.accentSoft }} />
          </View>
        </View>
      </Animated.View>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 16 }}>{label}…</Text>
      {pct !== null ? (
        <View style={{ width: 200, marginTop: 12, alignItems: 'center' }}>
          <View style={{ width: '100%', height: 6, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', borderRadius: 999, backgroundColor: colors.accent }} />
          </View>
          <Text style={{ marginTop: 7, fontSize: 13, fontWeight: '700', color: colors.accentInk }}>{pct}%</Text>
        </View>
      ) : null}
    </View>
  );
}

export default BookLoader;
