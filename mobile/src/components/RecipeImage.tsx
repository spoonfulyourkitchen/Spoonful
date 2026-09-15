import React, { useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { colors } from '../theme';
import { CroppedImage } from './CroppedImage';

/**
 * Recipe photo. When a real remote image exists and loads we show it;
 * otherwise a warm decorative plate tile (no emoji, per the design rules).
 *
 * 3.2.2: `thumbWidth` lädt eine kleine Bildvariante (siehe lib/image-url.ts).
 * Ohne das hing eine Liste mit 24 Kacheln an 24 Originalfotos — der übliche
 * Grund für Ruckeln, Akku-Durst und Abstürze auf kleinen Handys.
 */
export function RecipeImage({
  uri,
  style,
  imageStyle,
  thumbWidth,
}: {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: object;
  thumbWidth?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !uri || failed;

  return (
    <View
      style={[
        {
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {showFallback ? (
        <Svg width="100%" height="100%" viewBox="0 0 120 120">
          <G>
            <Circle cx="60" cy="60" r="42" fill={colors.accentTint} />
            <Circle cx="60" cy="60" r="34" fill={colors.card} />
            <Ellipse cx="60" cy="62" rx="26" ry="14" fill={colors.accentSoft} />
            <Path
              d="M60 60 q-26 -18 -4 -26 q22 -8 8 24 M60 60 q26 -18 4 -26 q-22 -8 -8 24"
              stroke={colors.accent}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />
            <Circle cx="44" cy="78" r="1.6" fill={colors.accent} opacity="0.6" />
            <Circle cx="60" cy="82" r="2" fill={colors.accent} opacity="0.45" />
            <Circle cx="74" cy="77" r="1.4" fill={colors.accent} opacity="0.55" />
          </G>
        </Svg>
      ) : (
        /* 3.1.0: zeigt den vom Nutzer gewählten Bild-Ausschnitt (siehe PhotoCropModal) */
        <CroppedImage
          uri={uri}
          thumbWidth={thumbWidth}
          style={{ width: '100%', height: '100%' }}
          imageStyle={imageStyle}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

export default RecipeImage;

