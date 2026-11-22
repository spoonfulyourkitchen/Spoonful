import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { QrCode, TriangleAlert, UsersRound, X } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { colors, fonts, rgbaHelper } from '../theme';
import { useTranslation } from '../lib/i18n';

export function HouseholdQrScannerModal({
  visible,
  onClose,
  onCode,
}: {
  visible: boolean;
  onClose: () => void;
  onCode: (raw: string) => void;
}) {
  const { t } = useTranslation();
  const [liveError, setLiveError] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (visible) {
      setLiveError(false);
      setManual('');
    }
  }, [visible]);

  
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onClose(), 60000);
    return () => clearTimeout(timer);
  }, [visible, onClose]);

  const liveHtml = useMemo(
    () => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{margin:0;background:#000;height:100%}video{width:100%;height:100%;object-fit:cover}
.corner{position:fixed;width:34px;height:34px;border:4px solid #F97316;box-sizing:border-box}
.tl{left:14%;top:22%;border-right:0;border-bottom:0;border-top-left-radius:14px}
.tr{right:14%;top:22%;border-left:0;border-bottom:0;border-top-right-radius:14px}
.bl{left:14%;bottom:22%;border-right:0;border-top:0;border-bottom-left-radius:14px}
.br{right:14%;bottom:22%;border-left:0;border-top:0;border-bottom-right-radius:14px}</style></head>
<body><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
<video id="v" playsinline autoplay muted></video>
<script src="file:///android_asset/zxing.min.js"></script>
<script>
function report(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }
function go(){
  try{
    if (!window.ZXing || !window.ZXing.BrowserMultiFormatReader) { report({ error: 'decoder-missing' }); return; }
    var hints = new Map();
    if (ZXing.DecodeHintType) {
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
    }
    var reader = new ZXing.BrowserMultiFormatReader(hints);
    var done = false;
    reader.decodeFromVideoDevice(null, 'v', function(result){
      if (!result || done) return;
      done = true;
      report({ code: result.getText() });
      try { reader.reset(); } catch(e){}
    }).catch(function(e){ report({ error: String(e && e.message ? e.message : e) }); });
  } catch(e){ report({ error: String(e) }); }
}
window.addEventListener('load', go);
</script></body></html>`,
    [],
  );

  const onMessage = (event: any) => {
    let data: any = {};
    try {
      data = JSON.parse(event?.nativeEvent?.data ?? '{}');
    } catch {
      data = {};
    }
    if (data?.error) {
      setLiveError(true);
      return;
    }
    const raw = String(data?.code ?? '').trim();
    if (!raw) return;
    onCode(raw);
    onClose();
  };

  const useManual = () => {
    const value = manual.trim().toUpperCase();
    if (!value) return;
    onCode(value);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 18, backgroundColor: colors.overlayStrong }}>
          <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 26, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 15, backgroundColor: colors.accentSoft }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
                <UsersRound size={18} color={colors.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>{t('s.hhScanTitle')}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{t('s.hhScanIntro')}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={{ padding: 18 }}>
              <View style={{ height: 240, borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' }}>
                {liveError ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <TriangleAlert size={22} color={colors.rose} />
                    <Text style={{ color: '#fff', fontSize: 13, textAlign: 'center', marginTop: 9 }}>{t('s.hhScanNoCamera')}</Text>
                  </View>
                ) : (
                  <WebView
                    originWhitelist={['*']}
                    source={{ html: liveHtml, baseUrl: 'file:///android_asset/' }}
                    allowFileAccess
                    allowFileAccessFromFileURLs
                    allowUniversalAccessFromFileURLs
                    javaScriptEnabled
                    domStorageEnabled={false}
                    mediaPlaybackRequiresUserAction={false}
                    allowsInlineMediaPlayback
                    onMessage={onMessage}
                    onPermissionRequest={(event: any) => {
                      try {
                        const request = event?.nativeEvent?.request;
                        const resources = event?.nativeEvent?.resources ?? ['android.webkit.resource.VIDEO_CAPTURE'];
                        if (request?.grant) request.grant(resources);
                        else if (event?.nativeEvent?.grant) event.nativeEvent.grant(resources);
                      } catch {
                        setLiveError(true);
                      }
                    }}
                    onError={() => setLiveError(true)}
                    style={{ flex: 1, backgroundColor: '#000' }}
                  />
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }}>
                <QrCode size={15} color={colors.accent} />
                <Text style={{ flex: 1, fontSize: 12.5, color: colors.textSecondary }}>{t('s.hhQrScanHint')}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder }} />
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {t('s.hhScanManual')}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TextInput
                  value={manual}
                  onChangeText={setManual}
                  autoCapitalize="characters"
                  placeholder={t('s.hhScanManualPh')}
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={useManual}
                  style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 12, color: colors.textPrimary, fontSize: 15 }}
                />
                <Pressable
                  onPress={useManual}
                  disabled={!manual.trim()}
                  accessibilityRole="button"
                  accessibilityLabel={t('s.hhScanJoin')}
                  style={({ pressed }) => [{ borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.darkButton, opacity: !manual.trim() ? 0.5 : pressed ? 0.8 : 1 }]}
                >
                  <Text style={{ color: colors.darkButtonText, fontWeight: '800' }}>{t('s.hhScanJoin')}</Text>
                </Pressable>
              </View>

              {liveError ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderRadius: 14, backgroundColor: rgbaHelper(colors.accent, 0.12), padding: 12 }}>
                  <QrCode size={15} color={colors.accent} />
                  <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>{t('s.hhScanNoCamera')}</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('s.scanLiveHint')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default HouseholdQrScannerModal;
