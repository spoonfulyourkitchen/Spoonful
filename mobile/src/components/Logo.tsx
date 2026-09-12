import React from 'react';
import { Image, View } from 'react-native';

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
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={LOGO}
        style={{ width: size, height: size, borderRadius: radius ?? 0 }}
        resizeMode="contain"
        accessible
        accessibilityLabel="Spoonful"
      />
    </View>
  );
}

export default SpoonfulLogo;
