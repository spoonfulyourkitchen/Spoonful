import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Camera, Image as ImageIcon, RotateCcw, ScanLine, Search, TriangleAlert, X } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';
import { pickSharpPhoto, takeSharpPhoto } from '../lib/photo';
import { searchFoods, type FoodHit } from '../lib/foodFacts';
import { BARCODE_L10N, pick } from '../lib/l10n';
import { Popup } from './Popup';

export function BarcodeScannerModal({
  visible,
  onClose,
  onCode,
  accept = 'numeric',
}: {
  visible: boolean;
  onClose: () => void;
  onCode: (code: string) => void;
  
  accept?: 'numeric' | 'any';
}) {
  const { t, lang } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [manual, setManual] = useState('');
  const [notice, setNotice] = useState<'blurry' | 'noCode' | null>(null);
  
  const [searchQ, setSearchQ] = useState('');
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [live, setLive] = useState(true);
  const [liveError, setLiveError] = useState(false);

  useEffect(() => {
    if (visible) {
      setLive(true);
      setLiveError(false);
      return;
    }
    setImage(null);
    setBusy(false);
    setFailed(false);
    setProgress({ done: 0, total: 0 });
    setManual('');
    setNotice(null);
  }, [visible]);

  

  useEffect(() => {
    if (!visible || !live || busy) return;
    const timer = setTimeout(() => onClose(), 45000);
    return () => clearTimeout(timer);
  }, [visible, live, busy, onClose]);

  const grab = async (source: 'camera' | 'library') => {
    setFailed(false);
    setNotice(null);
    setProgress({ done: 0, total: 0 });
    setBusy(true);
    try {
      const photo = source === 'camera' ? await takeSharpPhoto() : await pickSharpPhoto();
      if (!photo?.base64) {
        setBusy(false);
        return;
      }
      setImage(`data:${photo.type || 'image/jpeg'};base64,${photo.base64}`);
    } catch {
      setBusy(false);
      setFailed(true);
    }
  };

  

  const html = useMemo(() => {
    if (!image) return '';
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#000">
<script src="file:///android_asset/zxing.min.js"></script>
<script>
var SRC = ${JSON.stringify(image)};
function report(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }
window.onerror = function(m){ report({ error: String(m) }); };

function hints(hard){
  var h = new Map();
  try {
    if (hard) {
      h.set(ZXing.DecodeHintType.TRY_HARDER, true);
      h.set(ZXing.DecodeHintType.ALSO_INVERTED, true);
    }
    h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, hard ? [
      ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.ITF
    ] : [
      ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128
    ]);
  } catch(e){}
  return h;
}

function sharpness(img){
  try {
    var w = 150, h = Math.max(1, Math.round(150 * (img.naturalHeight || img.height) / (img.naturalWidth || img.width)));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h).data, g = [], i, n = w * h;
    for (i = 0; i < n; i++) g.push(d[i*4]*0.299 + d[i*4+1]*0.587 + d[i*4+2]*0.114);
    var sum = 0, k = 0;
    for (var y = 1; y < h-1; y++) for (var xx = 1; xx < w-1; xx++) {
      var idx = y*w+xx;
      sum += Math.abs(4*g[idx] - g[idx-1] - g[idx+1] - g[idx-w] - g[idx+w]); k++;
    }
    return k ? sum/k : 0;
  } catch(e){ return -1; }
}

function prepped(img, o){
  var sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
  var sx = 0, sy = 0, cw = sw, ch = sh;
  if (o.crop) { cw = Math.round(sw*o.crop); ch = Math.round(sh*o.crop); sx = Math.round((sw-cw)/2); sy = Math.round((sh-ch)/2); }
  var w = Math.max(1, Math.round(cw*(o.scale||1))), h = Math.max(1, Math.round(ch*(o.scale||1)));
  var rot = o.rotate || 0;
  var c = document.createElement('canvas');
  c.width = rot ? h : w; c.height = rot ? w : h;
  var x = c.getContext('2d');
  x.save();
  try { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; } catch(e){}
  if (rot) { x.translate(c.width/2, c.height/2); x.rotate(rot * Math.PI/180); x.drawImage(img, sx, sy, cw, ch, -w/2, -h/2, w, h); }
  else { x.drawImage(img, sx, sy, cw, ch, 0, 0, w, h); }
  x.restore();
  var d = x.getImageData(0, 0, c.width, c.height), p = d.data, g = [], i, lo = 255, hi = 0, v;
  for (i = 0; i < p.length; i += 4) { v = p[i]*0.299 + p[i+1]*0.587 + p[i+2]*0.114; g.push(v); if (v < lo) lo = v; if (v > hi) hi = v; }
  var span = Math.max(1, hi - lo);
  for (i = 0; i < g.length; i++) {
    v = (g[i] - lo) / span * 255;
    if (o.binary) v = v > 128 ? 255 : 0;
    var q = i*4; p[q] = p[q+1] = p[q+2] = v; p[q+3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}

function decodeCanvas(canvas, hard){
  var src = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
  var bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(src));
  var reader = new ZXing.MultiFormatReader();
  reader.setHints(hints(hard));
  return reader.decode(bitmap).getText();
}

var PASSES = [
  { scale: 1 },
  { scale: 1.5 },
  { scale: 1, binary: true },
  { scale: 1.5, rotate: 90 },
  { scale: 1.5, rotate: 270 },
  { scale: 2, crop: 0.7, binary: true }
];

function fallbackReader(sharp){
  try {
    var reader = new ZXing.BrowserMultiFormatReader(hints(true));
    reader.decodeFromImageUrl(SRC)
      .then(function (r) { report({ code: r.getText(), sharp: sharp }); })
      .catch(function () { report({ error: 'not-found', sharp: sharp }); });
  } catch (e) {
    report({ error: 'not-found', sharp: sharp });
  }
}

function attempt(i, img, sharp){
  if (i >= PASSES.length) { fallbackReader(sharp); return; }
  report({ progress: i + 1, total: PASSES.length });
  var code = null;
  setTimeout(function () {
    try { code = decodeCanvas(prepped(img, PASSES[i]), i === PASSES.length - 1); } catch (e) { code = null; }
    if (code) { report({ code: code, sharp: sharp }); return; }
    attempt(i + 1, img, sharp);
  }, 20);
}

function run(){
  if (!window.ZXing) { report({ error: 'decoder-missing' }); return; }
  var img = new Image();
  img.onload = function(){ attempt(0, img, Math.round(sharpness(img))); };
  img.onerror = function(){ report({ error: 'image-load' }); };
  img.src = SRC;
}
if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
</script>
</body></html>`;
  }, [image]);

  
  const onMessage = (event: any) => {
    let data: any = {};
    try {
      data = JSON.parse(event?.nativeEvent?.data ?? '{}');
    } catch {
      data = {};
    }
    if (data?.progress) {
      setProgress({ done: Number(data.progress) || 0, total: Number(data.total) || 0 });
      return;
    }
    const code = String(data?.code ?? '').replace(/\D/g, '');
    const sharp = Number(data?.sharp ?? -1);
    setBusy(false);
    setImage(null);
    setProgress({ done: 0, total: 0 });
    if (code.length >= 6) {
      onCode(code);
      onClose();
      return;
    }
    setFailed(true);
    setNotice(sharp >= 0 && sharp < 3.2 ? 'blurry' : 'noCode');
  };

  
  const runSearch = async () => {
    const q = searchQ.trim();
    if (q.length < 3) return;
    setSearching(true);
    try {
      setHits(await searchFoods(q, 12));
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  const useManual = () => {
    const code = manual.replace(/\D/g, '');
    if (code.length < 6) return;
    onCode(code);
    onClose();
  };

  
  const liveFormats =
    accept === 'any'
      ? 'ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.DATA_MATRIX, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39, ZXing.BarcodeFormat.EAN_13'
      : 'ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128';

  const liveHtml = useMemo(
    () => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{margin:0;background:#000;height:100%;overflow:hidden}video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.frame{position:fixed;left:8%;right:8%;top:33%;height:34%;border:2px solid rgba(255,255,255,.9);border-radius:14px;box-sizing:border-box;box-shadow:0 0 0 100vmax rgba(0,0,0,.4)}</style></head>
<body><div class="frame"></div><video id="v" playsinline autoplay muted></video>
<script src="file:///android_asset/zxing.min.js"></script>
<script>
var FORMATS = [${liveFormats}];
function report(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }
var video = document.getElementById('v');
var done = false;
function finish(code){ if (done) return; done = true; try { if (video.srcObject) video.srcObject.getTracks().forEach(function(t){ t.stop(); }); } catch(e){} report({ code: String(code) }); }

function startNative(){
  var det = new window.BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','qr_code'] });
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  function tick(){
    if (done) return;
    if (video.readyState >= 2 && video.videoWidth) {
      var vw = video.videoWidth, vh = video.videoHeight;
      var sx = vw * 0.05, sy = vh * 0.26, sw = vw * 0.9, sh = vh * 0.48;
      canvas.width = 720; canvas.height = Math.max(1, Math.round(720 * sh / sw));
      try { ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height); } catch(e){}
      det.detect(canvas).then(function(list){
        if (list && list.length) { finish(list[0].rawValue); return; }
        setTimeout(tick, 40);
      }).catch(function(){ setTimeout(tick, 60); });
    } else setTimeout(tick, 60);
  }
  tick();
}

function startZxing(){
  if (!window.ZXing) { report({ error: 'decoder-missing' }); return; }
  var hints = new Map();
  try { if (ZXing.DecodeHintType) hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, FORMATS); } catch(e){}
  var reader = new ZXing.MultiFormatReader();
  reader.setHints(hints);
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  var busy = false;
  function frame(){
    if (done) return;
    if (busy || video.readyState < 2 || !video.videoWidth) { setTimeout(frame, 45); return; }
    busy = true;
    try {
      var vw = video.videoWidth, vh = video.videoHeight;
      var sx = vw * 0.05, sy = vh * 0.24, sw = vw * 0.9, sh = vh * 0.52;
      var w = 720, h = Math.max(1, Math.round(w * sh / sw));
      canvas.width = w; canvas.height = h;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      var src = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      var bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(src));
      var text = reader.decode(bitmap).getText();
      busy = false;
      if (text) { finish(text); return; }
    } catch (e) { busy = false; }
    setTimeout(frame, 30);
  }
  frame();
}

function start(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { report({ error: 'camera' }); return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
    .then(function(stream){
      video.srcObject = stream;
      var play = video.play();
      if (play && play.catch) play.catch(function(){});
      if (window.BarcodeDetector) { try { startNative(); return; } catch(e){} }
      startZxing();
    })
    .catch(function(){ report({ error: 'camera' }); });
}
if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
</script></body></html>`,
    [liveFormats],
  );

  
  const onLiveMessage = (event: any) => {
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
    const raw = String(data?.code ?? '');
    if (!raw) return;
    if (accept === 'any') {
      onCode(raw);
      onClose();
      return;
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 6) {
      onCode(digits);
      onClose();
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', padding: 18, backgroundColor: colors.overlayStrong }}>
            <View style={{ maxHeight: '92%', borderRadius: 24, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.bg, overflow: 'hidden' }}>
              <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                    <ScanLine size={17} color={colors.accent} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
                    {pick(lang, BARCODE_L10N.scanTitle)}
                  </Text>
                  <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={pick(lang, BARCODE_L10N.cancel)}>
                    <X size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>

                {live && !image ? (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ height: 200, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
                      {liveError ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                          <TriangleAlert size={18} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 12.5, textAlign: 'center', marginTop: 8 }}>{t('s.scanNoCamera')}</Text>
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
                          onMessage={onLiveMessage}
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
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary, marginTop: 10 }}>{t('s.scanLive')}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <Pressable
                        onPress={() => setLive(false)}
                        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Camera size={13} color={colors.textSecondary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>{t('s.scanFallback')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void grab('library')}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel={pick(lang, BARCODE_L10N.fromGallery)}
                        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.surfaceMuted, opacity: busy ? 0.6 : pressed ? 0.7 : 1 }]}
                      >
                        <ImageIcon size={13} color={colors.textSecondary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>{pick(lang, BARCODE_L10N.fromGallery)}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                <View style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 12 }}>
                    <Search size={16} color={colors.textSecondary} />
                    <TextInput value={searchQ} onChangeText={setSearchQ} onSubmitEditing={() => void runSearch()} placeholder={t('s.scanSearchPh')} placeholderTextColor={colors.textSecondary} style={[{ flex: 1, paddingVertical: 11, fontSize: 15, color: colors.textPrimary }, { backgroundColor: 'transparent' }]}/>
                    <Pressable onPress={() => void runSearch()} hitSlop={8}>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.accent }}>{t('s.scanSearchGo')}</Text>
                    </Pressable>
                  </View>
                  {searching ? <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 10 }} /> : null}
                  {hits.map((hit) => (
                    <Pressable key={hit.code} onPress={() => { onCode(hit.code); onClose(); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                      <ImageIcon size={15} color={colors.textSecondary} />
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: colors.textPrimary }}>{hit.name}{hit.brand ? ` · ${hit.brand}` : ''}</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>{hit.kcal != null ? `${hit.kcal} kcal` : ''}</Text>
                    </Pressable>
                  ))}
                  {!searching && !hits.length && searchQ.trim().length > 2 ? (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>{t('s.scanNoHits')}</Text>
                  ) : null}
                </View>

                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 12 }}>
                    <ScanLine size={16} color={colors.textSecondary} />
                    <TextInput
                      value={manual}
                      onChangeText={setManual}
                      keyboardType="number-pad"
                      placeholder={pick(lang, BARCODE_L10N.manual)}
                      placeholderTextColor={colors.textSecondary}
                      onSubmitEditing={useManual}
                      style={[{ flex: 1, paddingVertical: 11, fontSize: 15, color: colors.textPrimary }, { backgroundColor: 'transparent' }]}/>
                    <Pressable onPress={useManual} hitSlop={8} disabled={manual.replace(/\D/g, '').length < 6}>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: manual.replace(/\D/g, '').length < 6 ? colors.textSecondary : colors.accent }}>
                        {pick(lang, BARCODE_L10N.use)}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {live && !image ? null : (
                  <>
                <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: colors.surfaceMuted, padding: 12 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>
                    {pick(lang, BARCODE_L10N.sharpnessTitle)}
                  </Text>
                  {[BARCODE_L10N.tipFill, BARCODE_L10N.tipDistance, BARCODE_L10N.tipLight].map((tip) => (
                    <View key={tip.en} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 6 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 6, backgroundColor: colors.accent }} />
                      <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>{pick(lang, tip)}</Text>
                    </View>
                  ))}
                </View>
                  </>
                )}

                {!live ? (
                  <Pressable
                    onPress={() => void grab('camera')}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={pick(lang, BARCODE_L10N.takePhoto)}
                    style={({ pressed }) => [{ alignSelf: 'flex-start', marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.darkButton, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
                  >
                    <Camera size={15} color={colors.darkButtonText} strokeWidth={2.2} />
                    <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 13.5 }}>{pick(lang, BARCODE_L10N.takePhoto)}</Text>
                  </Pressable>
                ) : null}

                {image ? (
                  <View style={{ marginTop: 14 }}>
                    <Image source={{ uri: image }} style={{ width: '100%', height: 132, borderRadius: 16, backgroundColor: colors.surfaceMuted }} resizeMode="contain" />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <ActivityIndicator size="small" color={colors.accent} />
                      <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                        {pick(lang, BARCODE_L10N.reading)}
                        {progress.total ? ` · ${pick(lang, BARCODE_L10N.pass)} ${progress.done}/${progress.total}` : ''}
                      </Text>
                    </View>
                    <View style={{ width: 1, height: 1, opacity: 0 }} pointerEvents="none">
                      <WebView
                        source={{ html }}
                        originWhitelist={['*']}
                        allowFileAccess
                        allowFileAccessFromFileURLs
                        allowUniversalAccessFromFileURLs
                        javaScriptEnabled
                        onMessage={onMessage}
                        onError={() => {
                          setBusy(false);
                          setImage(null);
                          setFailed(true);
                          setNotice('noCode');
                        }}
                        style={{ width: 1, height: 1, opacity: 0 }}
                      />
                    </View>
                  </View>
                ) : null}

                {failed ? (
                  <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: colors.roseBg, padding: 12 }}>
                    <TriangleAlert size={16} color={colors.rose} />
                    <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 17, color: colors.rose }}>
                      {pick(lang, BARCODE_L10N.notFound)}
                    </Text>
                  </View>
                ) : null}

                {failed ? (
                  <Pressable
                    onPress={() => void grab('camera')}
                    accessibilityRole="button"
                    accessibilityLabel={pick(lang, BARCODE_L10N.retry)}
                    style={({ pressed }) => [{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <RotateCcw size={16} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13.5 }}>{pick(lang, BARCODE_L10N.retry)}</Text>
                  </Pressable>
                ) : null}

              </ScrollView>
            </View>
          </View>
      
        </KeyboardAvoidingView></Modal>

      <Popup
        visible={!!notice}
        onClose={() => setNotice(null)}
        closeLabel={pick(lang, BARCODE_L10N.cancel)}
        icon={<TriangleAlert size={20} color={colors.accent} />}
        title={notice === 'blurry' ? pick(lang, BARCODE_L10N.blurryTitle) : pick(lang, BARCODE_L10N.noCodeTitle)}
        body={notice === 'blurry' ? pick(lang, BARCODE_L10N.blurry) : pick(lang, BARCODE_L10N.noCodeHere)}
        actions={[
          { label: pick(lang, BARCODE_L10N.retry), onPress: () => { setNotice(null); void grab('camera'); } },
          { label: pick(lang, BARCODE_L10N.cancel), variant: 'ghost', onPress: () => setNotice(null) },
        ]}
      />
    </>
  );
}

export default BarcodeScannerModal;
