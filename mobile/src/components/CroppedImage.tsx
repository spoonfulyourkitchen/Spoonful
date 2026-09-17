/**
 * 3.1.0: `CroppedImage` - zeigt ein Bild mit dem gespeicherten Ausschnitt.
 *
 * Ohne Ausschnitt verhält es sich wie ein normales <Image>. Mit Ausschnitt
 * (Fokuspunkt + Zoom, siehe lib/photo-crop.ts) wird der gewählte Bereich
 * gezeigt - in jeder Rahmengröße, weil mit Prozenten gerechnet wird.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';

import { imageSource, isThumbUrl } from '../lib/image-url';
import { clampCrop, getCrop, isCropDefault, type PhotoCrop } from '../lib/photo-crop';

export function CroppedImage({
  uri,
  source,
  style,
  imageStyle,
  resizeMode = 'cover',
  onError,
  thumbWidth,
}: {
  uri?: string | null;
  /** eigene Bildquelle (z. B. mit Headern); sonst wird `uri` benutzt */
  source?: any;
  style?: StyleProp<ViewStyle>;
  imageStyle?: object;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onError?: () => void;
  /**
   * 3.2.2: gewünschte Anzeigebreite in Punkten. Damit wird eine kleine
   * Bildvariante geladen (Speicher/Akku). Lädt sie nicht, kommt automatisch
   * das Original — es kann also nichts verschwinden.
   */
  thumbWidth?: number;
}) {
  const [crop, setCropState] = useState<PhotoCrop | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [tryOriginal, setTryOriginal] = useState(false);
  /**
   * 3.2.3: Bildgröße holen — damit der Ausschnitt wirklich dort sitzt, wo der
   * Rahmen war. Vorher wurde mit der Rahmen-Größe gerechnet, dadurch zeigte
   * ein breites Foto immer die Mitte statt der gewählten Stelle.
   */
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let alive = true;
    if (!uri) {
      setCropState(null);
      setImgSize(null);
      return () => {
        alive = false;
      };
    }
    getCrop(uri).then((c) => {
      if (alive) setCropState(c);
    });
    try {
      Image.getSize(
        uri,
        (w, h) => {
          if (alive && w > 0 && h > 0) setImgSize({ w, h });
        },
        () => undefined,
      );
    } catch {
      /* dann eben ohne Ausschnitt-Rechnung */
    }
    return () => {
      alive = false;
    };
  }, [uri]);

  useEffect(() => {
    setTryOriginal(false);
  }, [uri, thumbWidth]);

  const pictureSource = useMemo(
    () => source ?? imageSource(uri, thumbWidth, tryOriginal),
    [source, uri, thumbWidth, tryOriginal],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const handleError = () => {
    // Erst das Original versuchen, dann dem Aufrufer melden.
    if (thumbWidth && !tryOriginal && !source) {
      setTryOriginal(true);
      return;
    }
    onError?.();
  };

  const active = crop && !isCropDefault(crop) && size.w > 0 && size.h > 0;
  const c = active ? clampCrop(crop as PhotoCrop) : null;

  /* Cover-Maßstab × Zoom, dann den Fokuspunkt genau in die Mitte legen.
     3.3.0: die Bildgröße kommt aus dem Ausschnitt selbst (`iw`/`ih`) — nur wenn
     sie fehlt (alte Ausschnitte), wird sie nachgeladen. So stimmt der Ausschnitt
     auch bei Bildern, deren Größe nicht abfragbar ist. */
  const known = crop && crop.iw && crop.ih && crop.iw > 0 && crop.ih > 0
    ? { w: crop.iw, h: crop.ih }
    : imgSize;
  const view = (() => {
    if (!c || !known) return null;
    const base = Math.max(size.w / known.w, size.h / known.h);
    const scale = base * c.zoom;
    const drawW = known.w * scale;
    const drawH = known.h * scale;
    return { width: drawW, height: drawH, left: size.w / 2 - c.fx * drawW, top: size.h / 2 - c.fy * drawH };
  })();

  return (
    <View style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]} onLayout={onLayout}>
      {uri ? (
        view ? (
          <Image
            source={pictureSource}
            resizeMode="stretch"
            onError={handleError}
            style={{ position: 'absolute', left: view.left, top: view.top, width: view.width, height: view.height }}
          />
        ) : (
          <Image
            source={pictureSource}
            resizeMode={resizeMode}
            onError={handleError}
            style={[{ width: '100%', height: '100%' }, imageStyle]}
          />
        )
      ) : null}
    </View>
  );
}

/** Kleine Hilfe für Aufrufer/Tests: lädt diese Anzeige schon ein Thumbnail? */
export const croppedImageUsesThumb = (uri?: string | null, thumbWidth?: number) =>
  !!thumbWidth && isThumbUrl(imageSource(uri, thumbWidth)?.uri);

export default CroppedImage;

