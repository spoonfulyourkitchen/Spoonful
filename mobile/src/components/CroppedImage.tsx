/**
 * 3.1.0: `CroppedImage` - zeigt ein Bild mit dem gespeicherten Ausschnitt.
 *
 * Ohne Ausschnitt verhält es sich wie ein normales <Image>. Mit Ausschnitt
 * (Fokuspunkt + Zoom, siehe lib/photo-crop.ts) wird der gewählte Bereich
 * gezeigt - in jeder Rahmengröße, weil mit Prozenten gerechnet wird.
 */
import React, { useEffect, useState } from 'react';
import { Image, LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';

import { clampCrop, getCrop, isCropDefault, type PhotoCrop } from '../lib/photo-crop';

export function CroppedImage({
  uri,
  source,
  style,
  imageStyle,
  resizeMode = 'cover',
  onError,
}: {
  uri?: string | null;
  /** eigene Bildquelle (z. B. mit Headern); sonst wird `uri` benutzt */
  source?: any;
  style?: StyleProp<ViewStyle>;
  imageStyle?: object;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onError?: () => void;
}) {
  const [crop, setCropState] = useState<PhotoCrop | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    let alive = true;
    if (!uri) {
      setCropState(null);
      return () => {
        alive = false;
      };
    }
    getCrop(uri).then((c) => {
      if (alive) setCropState(c);
    });
    return () => {
      alive = false;
    };
  }, [uri]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const active = crop && !isCropDefault(crop) && size.w > 0 && size.h > 0;
  const c = active ? clampCrop(crop as PhotoCrop) : null;

  return (
    <View style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]} onLayout={onLayout}>
      {uri ? (
        <Image
          source={source ?? { uri }}
          resizeMode={resizeMode}
          onError={onError}
          style={[
            { width: '100%', height: '100%' },
            c
              ? {
                  width: size.w * c.zoom,
                  height: size.h * c.zoom,
                  transform: [
                    { translateX: (0.5 - c.fx) * size.w * c.zoom },
                    { translateY: (0.5 - c.fy) * size.h * c.zoom },
                  ],
                }
              : null,
            imageStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

export default CroppedImage;
