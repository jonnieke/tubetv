import type { ThumbnailOrientation } from '../lib/thumbnails';
import { supabase } from '../lib/supabase';

const bucket = 'catalogue-thumbnails';
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
export const thumbnailAccept = Object.keys(extensions).join(',');

export async function validateThumbnailFile(file: File, orientation: ThumbnailOrientation) {
  if (!extensions[file.type] || file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose a JPG, PNG, or WebP image up to 5 MB.');
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
  } catch {
    throw new Error('This image could not be opened.');
  } finally {
    URL.revokeObjectURL(url);
  }
  const { naturalWidth, naturalHeight } = image;
  if (orientation === 'landscape' ? naturalWidth <= naturalHeight : naturalHeight <= naturalWidth) {
    throw new Error(`Choose a ${orientation} image for this slot.`);
  }
}

export async function uploadCatalogueThumbnail(videoId: string, orientation: ThumbnailOrientation, file: File) {
  await validateThumbnailFile(file, orientation);
  const path = `${videoId}/${orientation}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const storage = supabase.storage.from(bucket);
  const { error } = await storage.upload(path, file, { cacheControl: '31536000', contentType: file.type });
  if (error) throw new Error(`Could not upload the ${orientation} thumbnail. ${error.message}`);
  return storage.getPublicUrl(path).data.publicUrl;
}
