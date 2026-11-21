import type { Video } from '../types';
import { getFreeEpisodeCount } from './monetization';
import { seriesSlug } from './series';

export type PromoChannel = 'tiktok' | 'whatsapp' | 'instagram' | 'youtube';

export interface PromoLinkOptions {
  video: Video;
  channel: PromoChannel;
  creatorCode?: string;
  siteOrigin?: string;
  totalSeriesEpisodes?: number;
}

export function buildCreatorPromoLink(options: PromoLinkOptions): string {
  const origin = (options.siteOrigin || 'https://www.tube.co.ke').replace(/\/$/, '');
  const slug = seriesSlug(options.video) || 'microdrama';
  const params = new URLSearchParams();
  params.set('utm_source', options.channel);
  params.set('utm_campaign', slug.slice(0, 60));
  if (options.creatorCode && options.creatorCode.trim()) {
    params.set('ref', options.creatorCode.trim().toUpperCase().slice(0, 32));
  }
  params.set('autoplay', '1');
  return `${origin}/watch/${encodeURIComponent(options.video.id)}?${params.toString()}`;
}

export function buildViralCaption(params: {
  video: Video;
  link: string;
  language?: 'en' | 'sw';
  totalSeriesEpisodes?: number;
}): string {
  const showName = params.video.seriesTitle || params.video.title;
  const freeCount = getFreeEpisodeCount(params.video, params.totalSeriesEpisodes);
  if (params.language === 'sw') {
    return `🔥 Usikose mabadiliko ya "${showName}"! Tazama Vipindi 1–${freeCount} BURE (bila kujisajili) kwenye TubeTV sasa: ${params.link}`;
  }
  return `😭🔥 Wait till you see the twist in "${showName}"! Watch Ep 1–${freeCount} FREE (no signup) on TubeTV right now: ${params.link}`;
}
