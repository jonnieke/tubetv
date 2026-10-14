import { supabase } from '../lib/supabase';

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** A new immutable path avoids stale CDN artwork and requires only INSERT rights. */
export async function uploadSeriesPoster(file: File): Promise<string> {
  const extension = extensions[file.type];
  if (!extension) throw new Error('Use a JPG, PNG or WebP poster.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Keep the poster under 5 MB.');
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('series-posters').upload(path, file, {
    contentType: file.type, cacheControl: '31536000', upsert: false,
  });
  if (error) throw new Error(`Poster upload failed: ${error.message}`);
  const { data } = supabase.storage.from('series-posters').getPublicUrl(path);
  return data.publicUrl;
}
