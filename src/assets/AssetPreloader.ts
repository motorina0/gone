const preloadedBlobs = new Map<string, Blob>();
const assetUrls = new Map<string, string>();

export interface PreloadProgress {
  loadedBytes: number;
  totalBytes: number;
  completedAssets: number;
  totalAssets: number;
}

export const preloadAssets = async (
  assets: Array<{url: string; bytes: number}>,
  onProgress: (progress: PreloadProgress) => void,
): Promise<void> => {
  const uniqueAssets = [...new Map(assets.map((asset) => [asset.url, asset])).values()];
  const totalBytes = uniqueAssets.reduce((total, asset) => total + asset.bytes, 0);
  let loadedBytes = 0;
  let completedAssets = 0;
  let cursor = 0;
  const report = (): void =>
    onProgress({loadedBytes, totalBytes, completedAssets, totalAssets: uniqueAssets.length});
  report();

  const worker = async (): Promise<void> => {
    while (cursor < uniqueAssets.length) {
      const asset = uniqueAssets[cursor]!;
      cursor += 1;
      if (!preloadedBlobs.has(asset.url)) {
        const response = await fetch(asset.url);
        if (!response.ok) {
          throw new Error(`Failed to preload ${new URL(asset.url).pathname}: ${response.status}`);
        }
        const parts: ArrayBuffer[] = [];
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            const part = value.buffer.slice(
              value.byteOffset,
              value.byteOffset + value.byteLength,
            ) as ArrayBuffer;
            parts.push(part);
            loadedBytes += value.byteLength;
            report();
          }
        } else {
          const part = await response.arrayBuffer();
          parts.push(part);
          loadedBytes += part.byteLength;
          report();
        }
        preloadedBlobs.set(
          asset.url,
          new Blob(parts, {type: response.headers.get('content-type') ?? undefined}),
        );
      } else {
        loadedBytes += asset.bytes;
      }
      completedAssets += 1;
      report();
    }
  };

  await Promise.all(Array.from({length: Math.min(6, uniqueAssets.length)}, worker));
  loadedBytes = totalBytes;
  report();
};

export const resolvePreloadedAsset = (url: string): string => {
  const blob = preloadedBlobs.get(url);
  if (!blob) return url;
  const existing = assetUrls.get(url);
  if (existing) return existing;
  const objectUrl = URL.createObjectURL(blob);
  assetUrls.set(url, objectUrl);
  return objectUrl;
};

export const resolveBundledAsset = (
  bundleUrl: string,
  offset: number,
  bytes: number,
  mimeType: string,
): string => {
  const key = `${bundleUrl}#${offset}:${bytes}`;
  const existing = assetUrls.get(key);
  if (existing) return existing;
  const bundle = preloadedBlobs.get(bundleUrl);
  if (!bundle) throw new Error(`High-resolution bundle was not preloaded: ${bundleUrl}`);
  const objectUrl = URL.createObjectURL(bundle.slice(offset, offset + bytes, mimeType));
  assetUrls.set(key, objectUrl);
  return objectUrl;
};
