import React from 'react';
import { Image, View } from 'react-native';
import { colors } from '../theme';

/**
 * Spoonful app logo.
 *
 * 2.0.0: the artwork now comes from the real brand icon (app-icons) instead of
 * the drawn SVG spoon - the same file that is used for the Android launcher
 * icon, so the app and the home screen show exactly the same logo.
 *
 * The given size is in logical pixels; the bundled PNG is 512 px, which keeps
 * the logo sharp on every screen density.
 */
const LOGO = require('../assets/logo.png');

export function SpoonfulLogo({ size = 84, radius }: { size?: number; radius?: number }) {
  /**
   * 3.2.3: Der Logo-Hintergrund kommt vom Theme (accentSoft + Theme-Rahmen),
   * damit das Symbol auf dunklen Themes nicht als heller Kasten wirkt.
   */
  const inner = Math.round(size * 0.86);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.26),
        overflow: 'hidden',
        backgroundColor: colors.accentSoft,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        source={LOGO}
        style={{ width: inner, height: inner }}
        resizeMode="contain"
        accessible
        accessibilityLabel="Spoonful"
      />
    </View>
  );
}

export default SpoonfulLogo;
