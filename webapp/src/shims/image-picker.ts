/**
 * react-native-image-picker on the web.
 *
 * The camera opens a real in-app camera (getUserMedia) with a shutter button
 * instead of relying on the `capture` attribute, which desktop browsers ignore
 * and mobile browsers handle inconsistently. The gallery is a hidden file
 * input. Both return the same response shape the app already consumes:
 * { didCancel, assets: [{ uri, base64, ... }] }.
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

function toAsset(dataUrl: string, width: number, height: number, name: string): Asset {
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  return {
    uri: dataUrl,
    fileName: name,
    type: dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
    width,
    height,
    base64,
    fileSize: Math.round((base64.length * 3) / 4),
  };
}

function limitSize(naturalWidth: number, naturalHeight: number, options: Options) {
  const maxW = Number(options.maxWidth ?? 0) || naturalWidth;
  const maxH = Number(options.maxHeight ?? 0) || naturalHeight;
  const scale = Math.min(1, maxW / naturalWidth, maxH / naturalHeight);
  return {
    scale,
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

async function processFile(file: File, options: Options): Promise<Asset | null> {
  const source = await readAsDataUrl(file);
  const img = await loadImage(source);
  const { scale, width, height } = limitSize(img.naturalWidth, img.naturalHeight, options);
  const mime = file.type || 'image/jpeg';

  let dataUrl = source;
  if (scale < 1 || mime !== 'image/jpeg') {
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

  return toAsset(dataUrl, width, height, file.name || `photo-${Date.now()}.jpg`);
}

function pickFile(source: 'camera' | 'library', options: Options): Promise<PickResponse> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ didCancel: true, assets: [] });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.mediaType === 'video' ? 'video/*' : 'image/*';
    if (options.selectionLimit && options.selectionLimit > 1) input.multiple = true;
    if (source === 'camera') input.setAttribute('capture', options.cameraType === 'front' ? 'user' : 'environment');
    input.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;';

    let settled = false;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (response: PickResponse) => {
      if (settled) return;
      settled = true;
      if (focusTimer) clearTimeout(focusTimer);
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(response);
    };

    const onFocus = () => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        if (!input.files || input.files.length === 0) finish({ didCancel: true, assets: [] });
      }, 900);
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
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

function openCamera(options: Options): Promise<PickResponse> {
  const media = (navigator as any)?.mediaDevices;
  if (!media?.getUserMedia || typeof document === 'undefined') return pickFile('camera', options);

  return new Promise<PickResponse>((resolve) => {
    let stream: MediaStream | null = null;
    let settled = false;
    let overlay: HTMLDivElement | null = null;

    const cleanup = () => {
      window.removeEventListener('keydown', onKey);
      try {
        stream?.getTracks().forEach((track) => track.stop());
      } catch {}
      stream = null;
      overlay?.remove();
      overlay = null;
    };

    const finish = (response: PickResponse) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(response);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish({ didCancel: true, assets: [] });
    };

    void media
      .getUserMedia({
        video: {
          facingMode: options.cameraType === 'front' ? 'user' : 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1920 },
        },
        audio: false,
      })
      .then((next: MediaStream) => {
        stream = next;
        const root = document.createElement('div');
        root.style.cssText =
          'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center;';

        const video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.autoplay = true;
        video.srcObject = next;
        video.style.cssText = 'width:100%;height:100%;object-fit:cover;background:#000;';

        const bar = document.createElement('div');
        bar.style.cssText =
          'position:absolute;left:0;right:0;bottom:0;padding:22px 18px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0));';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.setAttribute('aria-label', 'Cancel');
        cancel.textContent = '\u2715';
        cancel.style.cssText =
          'width:46px;height:46px;border-radius:23px;border:1px solid rgba(255,255,255,0.4);background:rgba(0,0,0,0.35);color:#fff;font-size:20px;line-height:1;cursor:pointer;';

        const shutter = document.createElement('button');
        shutter.type = 'button';
        shutter.setAttribute('aria-label', 'Take photo');
        shutter.style.cssText =
          'width:72px;height:72px;border-radius:36px;border:5px solid rgba(255,255,255,0.85);background:#fff;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,0.35);';

        const spacer = document.createElement('div');
        spacer.style.cssText = 'width:46px;height:46px;';

        const capture = () => {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) return;
          const { width, height } = limitSize(vw, vh, options);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', Number(options.quality ?? 0.7));
          finish({ didCancel: false, assets: [toAsset(dataUrl, width, height, `photo-${Date.now()}.jpg`)] });
        };

        cancel.addEventListener('click', () => finish({ didCancel: true, assets: [] }));
        shutter.addEventListener('click', capture);

        bar.appendChild(cancel);
        bar.appendChild(shutter);
        bar.appendChild(spacer);
        root.appendChild(video);
        root.appendChild(bar);
        document.body.appendChild(root);
        overlay = root;
        window.addEventListener('keydown', onKey);
        void video.play().catch(() => undefined);
      })
      .catch(() => {
        // The browser refused the camera (no device, blocked permission or
        // insecure origin). Fall back to the regular file picker.
        if (settled) return;
        settled = true;
        cleanup();
        void pickFile('camera', options).then(resolve, () => resolve({ didCancel: true, assets: [] }));
      });
  });
}

export function launchImageLibrary(options: Options = {}): Promise<PickResponse> {
  return pickFile('library', options);
}

export function launchCamera(options: Options = {}): Promise<PickResponse> {
  return openCamera(options);
}

export default { launchImageLibrary, launchCamera };
