export const MAX_QUICK_SCREENSHOTS = 10;
export const MAX_IMAGE_DIMENSION = 1280;
export const WEBP_QUALITY = 0.80;

export interface OptimizedScreenshot {
  id: string;
  /** Raw base64 payload (without data:...;base64, prefix) for OpenCode Go vision API */
  data: string;
  /** 'image/webp' (or 'image/jpeg' fallback) */
  mimeType: string;
  /** Full data URL ('data:image/webp;base64,...') for immediate local preview */
  preview: string;
  width: number;
  height: number;
}

export function calculateScaledDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_IMAGE_DIMENSION
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: maxDimension, height: maxDimension };
  }
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  if (width >= height) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round((height * maxDimension) / width)),
    };
  }
  return {
    width: Math.max(1, Math.round((width * maxDimension) / height)),
    height: maxDimension,
  };
}

export function isR2MediaKey(value: string): boolean {
  return typeof value === 'string' && (value.startsWith('r2:quick/') || value.startsWith('quick/'));
}

export function clampScreenshotList<T>(existing: T[], incoming: T[], max = MAX_QUICK_SCREENSHOTS): T[] {
  return [...existing, ...incoming].slice(0, max);
}

export function optimizeImageFile(file: File): Promise<OptimizedScreenshot> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const { width, height } = calculateScaledDimensions(img.width, img.height, MAX_IMAGE_DIMENSION);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', WEBP_QUALITY);
        let mimeType = 'image/webp';
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          mimeType = 'image/jpeg';
        }

        const commaIdx = dataUrl.indexOf(',');
        const rawBase64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;

        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          data: rawBase64,
          mimeType,
          preview: dataUrl,
          width,
          height,
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
