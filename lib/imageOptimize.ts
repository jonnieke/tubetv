const MAX_THUMBNAIL_EDGE = 1280;
const THUMBNAIL_QUALITY = 0.84;

/**
 * Downscale and compress uploaded or AI-generated thumbnails on the client before
 * sending them to Bunny CDN so mobile viewers load crisp ~50-150KB artwork.
 * Falls back to the original file if canvas/WebP encoding is unavailable or larger.
 */
export async function optimizeThumbnailFile(file: File): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image decode failed'));
        el.src = objectUrl;
      });

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) return file;

      const scale = Math.min(1, MAX_THUMBNAIL_EDGE / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/webp', THUMBNAIL_QUALITY);
      });

      if (!blob || (scale === 1 && blob.size >= file.size)) {
        return file;
      }

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'thumbnail';
      return new File([blob], `${baseName}.webp`, { type: blob.type || 'image/webp' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return file;
  }
}
