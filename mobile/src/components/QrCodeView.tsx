

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Rect } from 'react-native-svg';

import { colors } from '../theme';

export function QrCodeView({
  value,
  size = 220,
  dark = '#0F172A',
  light = '#FFFFFF',
}: {
  value: string;
  size?: number;
  dark?: string;
  light?: string;
}) {
  const [matrix, setMatrix] = useState<{ rows: string[]; w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMatrix(null);
    setFailed(false);
  }, [value]);

  const html = useMemo(() => {
    const payload = JSON.stringify(value ?? '');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{margin:0;padding:0;background:transparent}</style></head><body>
<script src="file:///android_asset/zxing.min.js"></script>
<script>
function report(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }
function build(writer, matrix){
  var w = matrix.getWidth(), h = matrix.getHeight(), rows = [];
  for (var y = 0; y < h; y++) { var s = ''; for (var x = 0; x < w; x++) s += matrix.get(x, y) ? '1' : '0'; rows.push(s); }
  return { rows: rows, w: w, h: h };
}
function run(){
  try {
    if (!window.ZXing || !window.ZXing.QRCodeWriter) { report({ error: 'no-writer' }); return; }
    var writer = new ZXing.QRCodeWriter();
    var payload = ${payload};
    var matrix = null;
    try {
      var hints = new Map();
      if (window.ZXing.EncodeHintType) hints.set(ZXing.EncodeHintType.MARGIN, 1);
      matrix = writer.encode(payload, ZXing.BarcodeFormat.QR_CODE, 0, 0, hints.size ? hints : undefined);
    } catch (e1) {
      matrix = writer.encode(payload, ZXing.BarcodeFormat.QR_CODE, 0, 0);
    }
    report(build(writer, matrix));
  } catch (e) { report({ error: String(e) }); }
}
if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
</script></body></html>`;
  }, [value]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: light, overflow: 'hidden' }}>
      {matrix ? (
        <Svg width={size} height={size} viewBox={`0 0 ${matrix.w} ${matrix.h}`}>
          <Rect x={0} y={0} width={matrix.w} height={matrix.h} fill={light} />
          {matrix.rows.map((row, y) =>
            row.split('').map((cell, x) =>
              cell === '1' ? <Rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={dark} /> : null,
            ),
          )}
        </Svg>
      ) : failed ? (
        <View style={{ width: size, height: size }} />
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
      {!matrix && !failed ? (
        <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
          <WebView
            originWhitelist={['*']}
            source={{ html, baseUrl: 'file:///android_asset/' }}
            javaScriptEnabled
            domStorageEnabled={false}
            scrollEnabled={false}
            style={{ width: 1, height: 1, opacity: 0 }}
            onMessage={(event: any) => {
              try {
                const data = JSON.parse(event?.nativeEvent?.data ?? '{}');
                if (data?.rows?.length) setMatrix({ rows: data.rows, w: Number(data.w), h: Number(data.h) });
                else setFailed(true);
              } catch {
                setFailed(true);
              }
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

export default QrCodeView;
