import React, { useState } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { colors } from '../theme';
import { useTranslation } from '../lib/i18n';
import { CroppedImage } from './CroppedImage';

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
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  const showFallback = !uri || failed;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
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
        <>
          <Svg width="100%" height="100%" viewBox="0 0 120 120">
            <G>
              <Circle cx="60" cy="60" r="42" fill={colors.accentTint} />
              <Circle cx="60" cy="60" r="34" fill={colors.card} />
              <Ellipse cx="60" cy="62" rx="26" ry="14" fill={colors.accentSoft} />
              <Path
                d="M60 60 q-26 -18 -4 -26 q22 -8 8 24 M60 60 q26 -18 4 -26 q-22 -8 -8 24"
                stroke={colors.accentInk}
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
          {width >= 130 ? (
            <View
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                bottom: 8,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: colors.card,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }}
              >
                {t('s.imageUnavailable')}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
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
