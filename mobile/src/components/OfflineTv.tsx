import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { colors } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Retro television "offline" screen (inspired by the classic CSS 404 design).
 * Shows a warm orange TV with "OFFLINE" on the screen — no 404 digits.
 */
export function OfflineTv({
  title = 'No connection',
  message = 'You are offline. This part of Spoonful needs the internet.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, paddingTop: insets.top, paddingHorizontal: 24, paddingBottom: 40 }}>
      {/* Antenna */}
      <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#3f1d00', backgroundColor: '#f27405', alignItems: 'center', justifyContent: 'center', transform: [{ translateY: 46 }] }}>
        <View style={{ width: 26, height: 6, borderRadius: 3, backgroundColor: '#a85103', transform: [{ rotate: '-20deg' }, { translateY: -18 }, { translateX: -8 }] }} />
        <View style={{ width: 30, height: 6, borderRadius: 3, backgroundColor: '#a85103', transform: [{ rotate: '18deg' }, { translateY: -20 }, { translateX: 12 }] }} />
      </View>

      {/* TV set */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 236, height: 128, borderRadius: 18,
            backgroundColor: '#d36604', borderWidth: 3, borderColor: '#1d0e01',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#7a3a00', shadowOpacity: 0.4, shadowOffset: { width: 4, height: 5 }, shadowRadius: 0, elevation: 4,
          }}
        >
          {/* screen */}
          <View style={{ width: 186, height: 104, borderRadius: 12, borderWidth: 2, borderColor: '#1d0e01', backgroundColor: '#2a2118', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', top: -30, left: -30, right: -30, height: 48, backgroundColor: 'rgba(255,255,255,0.09)', transform: [{ rotate: '-8deg' }] }} />
            <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: 4, color: '#fff9f0', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
              OFFLINE
            </Text>
            <Text style={{ position: 'absolute', bottom: 5, fontSize: 7, letterSpacing: 1.5, color: '#e8c27a' }}>NO SIGNAL</Text>
          </View>
        </View>

        {/* side buttons panel */}
        <View style={{ width: 54, height: 112, borderRadius: 12, borderWidth: 2, borderColor: '#1d0e01', backgroundColor: '#e69635', alignItems: 'center', justifyContent: 'center', gap: 12, transform: [{ translateX: -8 }], shadowColor: '#7a3a00', shadowOpacity: 0.4, shadowOffset: { width: 4, height: 5 }, shadowRadius: 0, elevation: 3 }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#7f5934', borderWidth: 2, borderColor: '#1d0e01' }} />
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#7f5934', borderWidth: 2, borderColor: '#1d0e01' }} />
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7f5934', borderWidth: 1.5, borderColor: '#1d0e01' }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7f5934', borderWidth: 1.5, borderColor: '#1d0e01' }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7f5934', borderWidth: 1.5, borderColor: '#1d0e01' }} />
          </View>
        </View>
      </View>

      {/* legs */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 196 }}>
        <View style={{ width: 22, height: 16, borderBottomWidth: 3, borderColor: '#1d0e01', backgroundColor: '#4d4d4d', transform: [{ translateY: -2 }] }} />
        <View style={{ width: 22, height: 16, borderBottomWidth: 3, borderColor: '#1d0e01', backgroundColor: '#4d4d4d', transform: [{ translateY: -2 }] }} />
      </View>

      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 26 }}>{title}</Text>
      <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 320 }}>{message}</Text>

      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, borderRadius: 999, backgroundColor: colors.darkButton, paddingHorizontal: 24, paddingVertical: 13, opacity: pressed ? 0.85 : 1 }]}
        >
          <WifiOff size={16} color={colors.darkButtonText} />
          <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 15 }}>Retry connection</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default OfflineTv;
