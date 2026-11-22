/**
 * react-native-image-picker on the web: a hidden file input, an optional
 * canvas resize (maxWidth / maxHeight / quality) and the same response shape
 * the app already consumes ({ didCancel, assets: [{ uri, base64, ... }] }).
 */
export type Asset = {
  uri: string;
  fileName?: string;
  type?: string;
  width?: number;
  height?: number;
  base64?: string;
  fileSize?: number;
};

export type PickResponse = { didCancel?: boolean; errorCode?: string; assets?: Asset[] };

type Options = {
  selectionLimit?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mediaType?: string;
  includeBase64?: boolean;
  cameraType?: string;
  saveToPhotos?: boolean;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image could not be read'));
    img.src = dataUrl;
  });
}

async function processFile(file: File, options: Options): Promise<Asset | null> {
  const source = await readAsDataUrl(file);
  const img = await loadImage(source);
  const maxW = Number(options.maxWidth ?? 0) || img.naturalWidth;
  const maxH = Number(options.maxHeight ?? 0) || img.naturalHeight;
  const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  let dataUrl = source;
  const mime = file.type || 'image/jpeg';
  const needsResize = scale < 1 || mime !== 'image/jpeg';
  if (needsResize) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      dataUrl = canvas.toDataURL('image/jpeg', Number(options.quality ?? 0.7));
    }
  }

  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  return {
    uri: dataUrl,
    fileName: file.name || `photo-${Date.now()}.jpg`,
    type: dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : mime,
    width,
    height,
    base64,
    fileSize: Math.round((base64.length * 3) / 4),
  };
}

function pick(source: 'camera' | 'library', options: Options): Promise<PickResponse> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ didCancel: true });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.mediaType === 'video' ? 'video/*' : 'image/*';
    if (options.selectionLimit && options.selectionLimit > 1) input.multiple = true;
    if (source === 'camera') input.setAttribute('capture', options.cameraType === 'front' ? 'user' : 'environment');
    input.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;';

    let settled = false;
    const finish = (response: PickResponse) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(response);
    };

    const onFocus = () => {
      // The picker closed without a selection.
      setTimeout(() => finish({ didCancel: true, assets: [] }), 700);
    };

    input.addEventListener('cancel', () => finish({ didCancel: true, assets: [] }));

    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) {
        finish({ didCancel: true, assets: [] });
        return;
      }
      void (async () => {
        const assets: Asset[] = [];
        for (const file of files) {
          try {
            const asset = await processFile(file, options);
            if (asset) assets.push(asset);
          } catch {
            // skip unreadable files, like the native picker does
          }
        }
        finish({ assets, didCancel: false });
      })();
    });

    document.body.appendChild(input);
    window.addEventListener('focus', onFocus, { once: true });
    input.click();
  });
}

export function launchImageLibrary(options: Options = {}): Promise<PickResponse> {
  return pick('library', options);
}

export function launchCamera(options: Options = {}): Promise<PickResponse> {
  return pick('camera', options);
}

export default { launchImageLibrary, launchCamera };
