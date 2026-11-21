import { supabase, isSupabaseConfigured } from './supabase';

export type BoostPackageCode = 'starter' | 'viral' | 'premiere';

export const CREATOR_BOOST_PACKAGES: Record<
  BoostPackageCode,
  {
    code: BoostPackageCode;
    label: string;
    budgetKes: number;
    targetCompletions: number;
    cpvKes: number;
    tagline: string;
  }
> = {
  starter: {
    code: 'starter',
    label: 'Starter Boost',
    budgetKes: 500,
    targetCompletions: 250,
    cpvKes: 2.0,
    tagline: '250 guaranteed 30s full views',
  },
  viral: {
    code: 'viral',
    label: 'Viral Boost',
    budgetKes: 1500,
    targetCompletions: 1000,
    cpvKes: 1.5,
    tagline: '1,000 guaranteed 30s full views',
  },
  premiere: {
    code: 'premiere',
    label: 'Premiere Takeover',
    budgetKes: 5000,
    targetCompletions: 4000,
    cpvKes: 1.25,
    tagline: '4,000 guaranteed 30s full views',
  },
};

export interface SponsorAd {
  id: string;
  title: string;
  advertiserName: string;
  videoUrl: string;
  clickUrl?: string;
  durationSeconds: number;
  isActive: boolean;
  approvalStatus: 'pending_review' | 'approved' | 'rejected' | 'completed';
  creatorCode?: string;
  targetSeriesKey?: string;
  packageCode?: BoostPackageCode;
  budgetKes: number;
  targetCompletions?: number;
  cpvKes: number;
  impressions: number;
  completions: number;
  createdAt: string;
}

export interface CreatorAdHostSummary {
  totalAdCompletionsHosted: number;
  totalCreatorShareKes: number;
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
  const statusRaw = String(row.approval_status || 'approved');
  const approvalStatus = (
    ['pending_review', 'approved', 'rejected', 'completed'].includes(statusRaw) ? statusRaw : 'approved'
  ) as SponsorAd['approvalStatus'];
  return {
    id: String(row.id || ''),
    title: String(row.title || 'Sponsor Spot'),
    advertiserName: String(row.advertiser_name || 'TubeTV Sponsor'),
    videoUrl: normalizeSponsorAdVideoUrl(String(row.video_url || '')),
    clickUrl: row.click_url ? String(row.click_url) : undefined,
    durationSeconds: Number(row.duration_seconds) || 30,
    isActive: Boolean(row.is_active),
    approvalStatus,
    creatorCode: row.creator_code ? String(row.creator_code) : undefined,
    targetSeriesKey: row.target_series_key ? String(row.target_series_key) : undefined,
    packageCode: row.package_code ? (String(row.package_code) as BoostPackageCode) : undefined,
    budgetKes: Number(row.budget_kes) || 0,
    targetCompletions:
      row.target_completions !== null && row.target_completions !== undefined
        ? Number(row.target_completions)
        : undefined,
    cpvKes: Number(row.cpv_kes) || 1.5,
    impressions: Number(row.impressions) || 0,
    completions: Number(row.completions) || 0,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export async function fetchActiveSponsorAds(excludeSeriesKey?: string): Promise<SponsorAd[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('sponsor_ads')
      .select('*')
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error || !Array.isArray(data)) return [];
    const mapped = data.map((row) => mapRow(row as Record<string, unknown>));
    if (!excludeSeriesKey) return mapped;
    // Smart cross-promotion: prefer ads from OTHER series so creators acquire new viewers
    const crossPromo = mapped.filter(
      (ad) => !ad.targetSeriesKey || ad.targetSeriesKey !== excludeSeriesKey,
    );
    return crossPromo.length > 0 ? crossPromo : mapped;
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
    .limit(60);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data.map((row) => mapRow(row as Record<string, unknown>)) : [];
}

export async function fetchCreatorBoostAds(creatorCode: string): Promise<SponsorAd[]> {
  if (!isSupabaseConfigured || !creatorCode.trim()) return [];
  try {
    const { data, error } = await supabase
      .from('sponsor_ads')
      .select('*')
      .eq('creator_code', creatorCode.trim().toUpperCase())
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function fetchCreatorAdHostEarnings(creatorName: string): Promise<CreatorAdHostSummary> {
  if (!isSupabaseConfigured || !creatorName.trim()) {
    return { totalAdCompletionsHosted: 0, totalCreatorShareKes: 0 };
  }
  try {
    const { data, error } = await supabase
      .from('sponsor_ad_completions')
      .select('creator_share_kes')
      .ilike('host_creator', creatorName.trim())
      .limit(2000);
    if (error || !Array.isArray(data)) {
      return { totalAdCompletionsHosted: 0, totalCreatorShareKes: 0 };
    }
    const totalCreatorShareKes = data.reduce(
      (sum, row) => sum + (Number((row as Record<string, unknown>).creator_share_kes) || 0),
      0,
    );
    return {
      totalAdCompletionsHosted: data.length,
      totalCreatorShareKes: Math.round(totalCreatorShareKes * 100) / 100,
    };
  } catch {
    return { totalAdCompletionsHosted: 0, totalCreatorShareKes: 0 };
  }
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
      approval_status: 'approved',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Failed to save sponsor ad.');
  return mapRow(data as Record<string, unknown>);
}

export async function submitCreatorBoostAd(input: {
  creatorCode: string;
  creatorName: string;
  showTitle: string;
  videoId: string;
  targetSeriesKey: string;
  trailerVideoUrl: string;
  packageCode: BoostPackageCode;
}): Promise<SponsorAd> {
  const pkg = CREATOR_BOOST_PACKAGES[input.packageCode];
  const normalizedUrl = normalizeSponsorAdVideoUrl(input.trailerVideoUrl);
  const siteOrigin =
    typeof window !== 'undefined' && window.location.origin.startsWith('https://')
      ? window.location.origin
      : 'https://www.tube.co.ke';
  const clickUrl = `${siteOrigin}/watch/${encodeURIComponent(input.videoId)}?utm_source=creator_boost&ref=${encodeURIComponent(input.creatorCode.trim().toUpperCase())}&autoplay=1`;

  const { data, error } = await supabase
    .from('sponsor_ads')
    .insert({
      title: `${input.showTitle.trim()} — ${pkg.label}`,
      advertiser_name: input.creatorName.trim() || 'TubeTV Creator',
      video_url: normalizedUrl,
      click_url: clickUrl,
      duration_seconds: 30,
      is_active: false,
      approval_status: 'pending_review',
      creator_code: input.creatorCode.trim().toUpperCase(),
      target_series_key: input.targetSeriesKey,
      package_code: pkg.code,
      budget_kes: pkg.budgetKes,
      target_completions: pkg.targetCompletions,
      cpv_kes: pkg.cpvKes,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Failed to submit boost campaign.');
  return mapRow(data as Record<string, unknown>);
}

export async function approveSponsorAd(id: string): Promise<void> {
  const { error } = await supabase
    .from('sponsor_ads')
    .update({ approval_status: 'approved', is_active: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
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
  host?: { hostVideoId?: string; hostCreator?: string },
): Promise<void> {
  if (!isSupabaseConfigured || !adId) return;
  try {
    await supabase.rpc('increment_sponsor_ad_metric', {
      p_ad_id: adId,
      p_metric: metric,
      p_host_video_id: host?.hostVideoId || null,
      p_host_creator: host?.hostCreator || null,
    });
  } catch {
    // Best-effort telemetry
  }
}
