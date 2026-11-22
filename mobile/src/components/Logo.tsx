import React from 'react';
import { Image } from 'react-native';

const LOGO = require('../assets/logo-mark.png');

export function SpoonfulLogo({ size = 84 }: { size?: number; radius?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible
      accessibilityLabel="Spoonful"
    />
  );
}

export function SpoonfulLogoPlain({ size = 84 }: { size?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible
      accessibilityLabel="Spoonful"
    />
  );
}

export default SpoonfulLogo;
