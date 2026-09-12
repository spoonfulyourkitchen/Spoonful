import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Camera, Image as ImageIcon, RotateCcw, ScanLine, TriangleAlert, X } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';
import { pickSharpPhoto, takeSharpPhoto } from '../lib/photo';
import { BARCODE_L10N, pick } from '../lib/l10n';
import { Popup } from './Popup';

/**
 * Barcode scan from a photo (2.1.0, rebuilt in 2.1.1).
 *
 * What changed in 2.1.1
 * - the photo is captured at full resolution and quality 1 ("perfectly sharp"),
 * - the decoder runs several passes over the picture (greyscale + contrast
 *   stretch, upscaling, 90°/270° rotation, binarising, centre crop) with
 *   TRY_HARDER + all common formats, so skewed or low contrast codes still read,
 * - a blurry picture is explained in a popup instead of failing silently,
 * - the whole flow is a popup: tips + camera first, then the result.
 *
 * The picture is decoded by ZXing inside a hidden WebView: `zxing.min.js` ships
 * as an Android asset (android/app/src/main/assets/zxing.min.js), so scanning
 * works offline and needs no extra native module.
 */
export function BarcodeScannerModal({
  visible,
  onClose,
  onCode,
}: {
  visible: boolean;
  onClose: () => void;
  onCode: (code: string) => void;
}) {
  const { lang } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [manual, setManual] = useState('');
  const [notice, setNotice] = useState<'blurry' | 'noCode' | null>(null);

  useEffect(() => {
    if (visible) return;
    setImage(null);
    setBusy(false);
    setFailed(false);
    setProgress({ done: 0, total: 0 });
    setManual('');
    setNotice(null);
  }, [visible]);

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

  /**
   * Decoding script: several prepared copies of the photo are handed to a
   * low-level ZXing reader. The first readable code wins.
   */
  const html = useMemo(() => {
    if (!image) return '';
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#000">
<script src="file:///android_asset/zxing.min.js"></script>
<script>
var SRC = ${JSON.stringify(image)};
function report(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }
window.onerror = function(m){ report({ error: String(m) }); };

function hints(){
  var h = new Map();
  try {
    h.set(ZXing.DecodeHintType.TRY_HARDER, true);
    h.set(ZXing.DecodeHintType.ALSO_INVERTED, true);
    h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.CODE_93, ZXing.BarcodeFormat.ITF, ZXing.BarcodeFormat.CODABAR,
      ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.DATA_MATRIX
    ]);
  } catch(e){}
  return h;
}

/* How sharp is the picture? Mean |laplacian| on a small greyscale copy. */
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

/* One prepared copy: crop -> scale -> rotate -> greyscale + contrast. */
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

function decodeCanvas(canvas){
  var src = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
  var bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(src));
  var reader = new ZXing.MultiFormatReader();
  reader.setHints(hints());
  return reader.decode(bitmap).getText();
}

var PASSES = [
  { scale: 1 },
  { scale: 1, binary: true },
  { scale: 2 },
  { scale: 1.6, rotate: 90 },
  { scale: 1.6, rotate: 270 },
  { scale: 2, crop: 0.6 },
  { scale: 1, crop: 0.85, binary: true }
];

/* Last resort: ZXing's own image reader (a different code path). */
function fallbackReader(sharp){
  try {
    var reader = new ZXing.BrowserMultiFormatReader(hints());
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
    try { code = decodeCanvas(prepped(img, PASSES[i])); } catch (e) { code = null; }
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

  /** Messages from the hidden decoder: progress per pass, then the code. */
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
    // A very low laplacian score means motion blur / too far away.
    setNotice(sharp >= 0 && sharp < 3.2 ? 'blurry' : 'noCode');
  };

  const useManual = () => {
    const code = manual.replace(/\D/g, '');
    if (code.length < 6) return;
    onCode(code);
    onClose();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
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

              {/* how to take a picture that decodes on the first pass */}
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

              <Pressable
                onPress={() => void grab('camera')}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={pick(lang, BARCODE_L10N.takePhoto)}
                style={({ pressed }) => [{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, backgroundColor: colors.accent, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
              >
                <Camera size={18} color={colors.accentText} strokeWidth={2.4} />
                <Text style={{ color: colors.accentText, fontWeight: '800', fontSize: 15 }}>{pick(lang, BARCODE_L10N.takePhoto)}</Text>
              </Pressable>

              <Pressable
                onPress={() => void grab('library')}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={pick(lang, BARCODE_L10N.fromGallery)}
                style={({ pressed }) => [{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 13, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
              >
                <ImageIcon size={17} color={colors.accent} />
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{pick(lang, BARCODE_L10N.fromGallery)}</Text>
              </Pressable>

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
                  {/* Hidden decoder: it only has to run, not to be visible. */}
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

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder }} />
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {pick(lang, BARCODE_L10N.manual)}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TextInput
                  value={manual}
                  onChangeText={setManual}
                  keyboardType="number-pad"
                  placeholder="4001234567890"
                  placeholderTextColor={colors.textSecondary}
                  style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 11, color: colors.textPrimary, fontSize: 15 }}
                />
                <Pressable
                  onPress={useManual}
                  disabled={manual.replace(/\D/g, '').length < 6}
                  accessibilityRole="button"
                  accessibilityLabel={pick(lang, BARCODE_L10N.use)}
                  style={({ pressed }) => [{ borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.darkButton, opacity: manual.replace(/\D/g, '').length < 6 ? 0.5 : pressed ? 0.8 : 1 }]}
                >
                  <Text style={{ color: colors.darkButtonText, fontWeight: '800' }}>{pick(lang, BARCODE_L10N.use)}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Why nothing was decoded - a popup instead of a line somewhere below. */}
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
