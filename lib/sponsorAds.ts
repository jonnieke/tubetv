import { supabase, isSupabaseConfigured } from './supabase';

export interface SponsorAd {
  id: string;
  title: string;
  advertiserName: string;
  videoUrl: string;
  clickUrl?: string;
  durationSeconds: number;
  isActive: boolean;
  impressions: number;
  completions: number;
  createdAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUNNY_PULL_ZONE = (
  (import.meta.env.VITE_BUNNY_PULL_ZONE as string) || 'vz-0fe79b1a-8ad.b-cdn.net'
)
  .replace(/^https?:\/\//i, '')
  .replace(/\/$/, '');

/**
 * Accepts a Bunny Stream video GUID, a Bunny HLS .m3u8 URL, or a direct MP4/WebM URL.
 */
export function normalizeSponsorAdVideoUrl(raw: string): string {
  const clean = raw.trim();
  if (!clean) return '';
  if (UUID_RE.test(clean)) {
    return `https://${BUNNY_PULL_ZONE}/${clean}/playlist.m3u8`;
  }
  return clean;
}

function mapRow(row: Record<string, unknown>): SponsorAd {
  return {
    id: String(row.id || ''),
    title: String(row.title || 'Sponsor Spot'),
    advertiserName: String(row.advertiser_name || 'TubeTV Sponsor'),
    videoUrl: normalizeSponsorAdVideoUrl(String(row.video_url || '')),
    clickUrl: row.click_url ? String(row.click_url) : undefined,
    durationSeconds: Number(row.duration_seconds) || 30,
    isActive: Boolean(row.is_active),
    impressions: Number(row.impressions) || 0,
    completions: Number(row.completions) || 0,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export async function fetchActiveSponsorAds(): Promise<SponsorAd[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('sponsor_ads')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function listAllSponsorAds(): Promise<SponsorAd[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('sponsor_ads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data.map((row) => mapRow(row as Record<string, unknown>)) : [];
}

export async function uploadSponsorAdFile(file: File): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured for ad uploads.');
  }
  const safeExt = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `ads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt || 'mp4'}`;
  const { error } = await supabase.storage.from('sponsor-ads').upload(path, file, {
    contentType: file.type || 'video/mp4',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('sponsor-ads').getPublicUrl(path);
  return data.publicUrl;
}

export async function createSponsorAd(input: {
  title: string;
  advertiserName: string;
  videoUrl: string;
  clickUrl?: string;
  durationSeconds?: number;
}): Promise<SponsorAd> {
  const normalizedUrl = normalizeSponsorAdVideoUrl(input.videoUrl);
  const { data, error } = await supabase
    .from('sponsor_ads')
    .insert({
      title: input.title.trim(),
      advertiser_name: input.advertiserName.trim(),
      video_url: normalizedUrl,
      click_url: input.clickUrl?.trim() || null,
      duration_seconds: Math.max(10, Math.min(90, Math.round(input.durationSeconds || 30))),
      is_active: true,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Failed to save sponsor ad.');
  return mapRow(data as Record<string, unknown>);
}

export async function toggleSponsorAdActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('sponsor_ads').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSponsorAd(id: string): Promise<void> {
  const { error } = await supabase.from('sponsor_ads').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function recordSponsorAdMetric(
  adId: string,
  metric: 'impressions' | 'completions',
): Promise<void> {
  if (!isSupabaseConfigured || !adId) return;
  try {
    await supabase.rpc('increment_sponsor_ad_metric', {
      p_ad_id: adId,
      p_metric: metric,
    });
  } catch {
    // Best-effort telemetry
  }
}
