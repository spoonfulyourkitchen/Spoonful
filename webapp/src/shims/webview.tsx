import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native-web';

let counter = 0;

type WebViewProps = {
  source?: { html?: string; uri?: string; baseUrl?: string };
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onError?: () => void;
  onLoadEnd?: () => void;
  style?: any;
  [key: string]: any;
};

/**
 * The app embeds small self-contained pages (barcode decoder, QR encoder).
 * On the web they run in an iframe; `window.ReactNativeWebView.postMessage`
 * is bridged to `onMessage` and the Android asset paths point at /vendor.
 */
export const WebView = React.forwardRef<unknown, WebViewProps>(function WebView(props, ref) {
  const { source, onMessage, onError, onLoadEnd, style } = props;
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const id = useMemo(() => `spoonful-wv-${++counter}-${Math.random().toString(36).slice(2, 8)}`, []);

  const html = useMemo(() => {
    const raw = source?.html;
    if (!raw) return '';
    const base = String((import.meta as any).env?.BASE_URL || '/');
    const patched = String(raw).replace(/file:\/\/\/android_asset\//g, `${base}vendor/`);
    const bridge = `<script>(function(){window.ReactNativeWebView={postMessage:function(d){try{parent.postMessage({__spoonfulWebView:${JSON.stringify(
      id,
    )},data:typeof d==='string'?d:JSON.stringify(d)},'*')}catch(e){}}}})();</script>`;
    if (/<head[^>]*>/i.test(patched)) return patched.replace(/<head[^>]*>/i, (m) => m + bridge);
    return bridge + patched;
  }, [id, source?.html]);

  useEffect(() => {
    if (!onMessage) return;
    const listener = (event: MessageEvent) => {
      const data = event.data as any;
      if (!data || data.__spoonfulWebView !== id) return;
      onMessage({ nativeEvent: { data: String(data.data ?? '') } });
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [id, onMessage]);

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <iframe
        ref={(node) => {
          frameRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as any).current = node;
        }}
        title={id}
        srcDoc={html || undefined}
        src={html ? undefined : source?.uri}
        allow="camera *; microphone *; autoplay; fullscreen; clipboard-write"
        onLoad={() => onLoadEnd?.()}
        onError={() => onError?.()}
        style={{ border: 0, width: '100%', height: '100%', display: 'block', background: 'transparent' }}
      />
    </View>
  );
});

export default WebView;
