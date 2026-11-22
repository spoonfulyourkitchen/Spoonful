

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
  
  source?: any;
  style?: StyleProp<ViewStyle>;
  imageStyle?: object;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onError?: () => void;
  

  thumbWidth?: number;
}) {
  const [crop, setCropState] = useState<PhotoCrop | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [tryOriginal, setTryOriginal] = useState(false);
  

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
    } catch {}
    return () => {
      alive = false;
    };
  }, [uri]);

  

  const onImageLoad = (event: any) => {
    const src = event?.nativeEvent?.source;
    if (src?.width > 0 && src?.height > 0) {
      setImgSize((prev) => (prev && prev.w === src.width && prev.h === src.height ? prev : { w: src.width, h: src.height }));
    }
  };

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
    if (thumbWidth && !tryOriginal && !source) {
      setTryOriginal(true);
      return;
    }
    onError?.();
  };

  const active = crop && !isCropDefault(crop) && size.w > 0 && size.h > 0;
  const c = active ? clampCrop(crop as PhotoCrop) : null;

  

  const known = crop && crop.iw && crop.ih && crop.iw > 0 && crop.ih > 0
    ? { w: crop.iw, h: crop.ih }
    : imgSize;
  const view = (() => {
    if (!c || !known || size.w <= 0 || size.h <= 0) return null;
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
            onLoad={onImageLoad}
            style={{ position: 'absolute', left: view.left, top: view.top, width: view.width, height: view.height }}
          />
        ) : (
          <Image
            source={pictureSource}
            resizeMode={resizeMode}
            onError={handleError}
            onLoad={onImageLoad}
            style={[{ width: '100%', height: '100%' }, imageStyle]}
          />
        )
      ) : null}
    </View>
  );
}

export const croppedImageUsesThumb = (uri?: string | null, thumbWidth?: number) =>
  !!thumbWidth && isThumbUrl(imageSource(uri, thumbWidth)?.uri);

export default CroppedImage;

