import { supabase, isSupabaseConfigured } from './supabase';

export interface SponsorSlot {
  id?: string;
  name: string;
  tagline: string;
  url: string;
  badge: string;
  logoUrl?: string;
  seriesKey?: string;
  packageTier?: 'presented_by' | 'free_season_unlock' | 'exclusive_preroll';
  unlocksFreeViewing?: boolean;
}

export interface ShowSponsorshipRecord {
  id: string;
  seriesKey: string;
  seriesTitle?: string;
  sponsorName: string;
  tagline: string;
  badge: string;
  logoUrl?: string;
  clickUrl: string;
  packageTier: 'presented_by' | 'free_season_unlock' | 'exclusive_preroll';
  unlocksFreeViewing: boolean;
  campaignBudgetKes: number;
  startsAt: string;
  endsAt?: string;
  isActive: boolean;
}

/**
 * Fallback env-configured B2B/brand sponsorship slot for free-tier viewers.
 * Set VITE_SPONSOR_NAME + VITE_SPONSOR_URL in Vercel env vars for a global fallback campaign.
 */
export function getActiveSponsor(): SponsorSlot | null {
  const name = (import.meta.env.VITE_SPONSOR_NAME as string | undefined)?.trim();
  const url = (import.meta.env.VITE_SPONSOR_URL as string | undefined)?.trim();
  if (!name || !url || !/^https:\/\//i.test(url)) return null;
  const tagline =
    (import.meta.env.VITE_SPONSOR_TAGLINE as string | undefined)?.trim() ||
    'Proudly supporting Kenyan creators and free episodes on TubeTV.';
  const badge = (import.meta.env.VITE_SPONSOR_BADGE as string | undefined)?.trim() || 'Presented by';
  return { name, tagline, url, badge };
}

const SPONSOR_CACHE_TTL_MS = 60_000;
const sponsorCache = new Map<string, { slot: SponsorSlot | null; fetchedAt: number }>();

function mapSponsorshipRow(row: Record<string, unknown>): SponsorSlot {
  const tierRaw = String(row.package_tier || 'presented_by');
  const packageTier = (
    ['presented_by', 'free_season_unlock', 'exclusive_preroll'].includes(tierRaw)
      ? tierRaw
      : 'presented_by'
  ) as SponsorSlot['packageTier'];

  return {
    id: String(row.id || ''),
    name: String(row.sponsor_name || 'TubeTV Partner'),
    tagline: String(row.tagline || 'Proudly supporting Kenyan creators on TubeTV.'),
    url: String(row.click_url || ''),
    badge: String(row.badge || (row.unlocks_free_viewing ? 'Free Season by' : 'Presented by')),
    logoUrl: row.logo_url ? String(row.logo_url) : undefined,
    seriesKey: row.series_key ? String(row.series_key) : undefined,
    packageTier,
    unlocksFreeViewing: Boolean(row.unlocks_free_viewing),
  };
}

/**
 * Fetches an active database-backed sponsorship for a specific show (by seriesId/slug)
 * or falls back to a global ('*') DB campaign, then to env-configured `getActiveSponsor()`.
 */
export async function fetchActiveShowSponsorship(seriesKeys: string[] = []): Promise<SponsorSlot | null> {
  const normalizedKeys = Array.from(
    new Set(
      seriesKeys
        .map((k) => k.trim())
        .filter(Boolean)
        .flatMap((k) => [k, k.toLowerCase()]),
    ),
  );
  const cacheKey = normalizedKeys.length > 0 ? normalizedKeys.join('|') : '*';
  const cached = sponsorCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SPONSOR_CACHE_TTL_MS) {
    return cached.slot;
  }

  if (!isSupabaseConfigured) {
    const fallback = getActiveSponsor();
    sponsorCache.set(cacheKey, { slot: fallback, fetchedAt: Date.now() });
    return fallback;
  }

  try {
    const lookupKeys = normalizedKeys.length > 0 ? [...normalizedKeys, '*'] : ['*'];
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('show_sponsorships')
      .select('*')
      .in('series_key', lookupKeys)
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && Array.isArray(data) && data.length > 0) {
      // Prefer exact show match over global '*' sponsorship
      const exactMatch = data.find((row) => String(row.series_key || '') !== '*');
      const chosen = mapSponsorshipRow((exactMatch || data[0]) as Record<string, unknown>);
      sponsorCache.set(cacheKey, { slot: chosen, fetchedAt: Date.now() });
      return chosen;
    }
  } catch {
    // Fall back to env sponsor on transient network issues
  }

  const fallback = getActiveSponsor();
  sponsorCache.set(cacheKey, { slot: fallback, fetchedAt: Date.now() });
  return fallback;
}

export async function createShowSponsorship(input: {
  seriesKey: string;
  seriesTitle?: string;
  sponsorName: string;
  tagline?: string;
  badge?: string;
  logoUrl?: string;
  clickUrl: string;
  packageTier?: 'presented_by' | 'free_season_unlock' | 'exclusive_preroll';
  unlocksFreeViewing?: boolean;
  campaignBudgetKes?: number;
  endsAt?: string | null;
}): Promise<ShowSponsorshipRecord> {
  const { data, error } = await supabase
    .from('show_sponsorships')
    .insert({
      series_key: input.seriesKey.trim(),
      series_title: input.seriesTitle?.trim() || null,
      sponsor_name: input.sponsorName.trim(),
      tagline: input.tagline?.trim() || 'Proudly supporting Kenyan creators and free episodes on TubeTV.',
      badge: input.badge?.trim() || (input.unlocksFreeViewing ? 'Free Season by' : 'Presented by'),
      logo_url: input.logoUrl?.trim() || null,
      click_url: input.clickUrl.trim(),
      package_tier: input.packageTier || (input.unlocksFreeViewing ? 'free_season_unlock' : 'presented_by'),
      unlocks_free_viewing: Boolean(input.unlocksFreeViewing),
      campaign_budget_kes: Math.max(0, Math.round(input.campaignBudgetKes || 0)),
      ends_at: input.endsAt || null,
      is_active: true,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create show sponsorship.');
  }
  sponsorCache.clear();
  return {
    id: String(data.id),
    seriesKey: String(data.series_key),
    seriesTitle: data.series_title ? String(data.series_title) : undefined,
    sponsorName: String(data.sponsor_name),
    tagline: String(data.tagline),
    badge: String(data.badge),
    logoUrl: data.logo_url ? String(data.logo_url) : undefined,
    clickUrl: String(data.click_url),
    packageTier: data.package_tier as ShowSponsorshipRecord['packageTier'],
    unlocksFreeViewing: Boolean(data.unlocks_free_viewing),
    campaignBudgetKes: Number(data.campaign_budget_kes) || 0,
    startsAt: String(data.starts_at),
    endsAt: data.ends_at ? String(data.ends_at) : undefined,
    isActive: Boolean(data.is_active),
  };
}
