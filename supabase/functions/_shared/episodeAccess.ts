export function isFreeMicroDramaEpisode(episode: number | undefined): boolean {
  return episode === 1 || episode === 2;
}

export function catalogueEpisode(title: string, taggedEpisode: string): number | undefined {
  const raw = taggedEpisode || title.match(/^S\d+\s*E(\d+)/i)?.[1];
  if (!raw || !/^\d+$/.test(raw)) return;
  const episode = Number(raw);
  return Number.isSafeInteger(episode) && episode > 0 ? episode : undefined;
}

export function isVerifiedPaymentIdentity(user: {
  is_anonymous?: boolean;
  email?: string;
  email_confirmed_at?: string;
  phone?: string;
  phone_confirmed_at?: string;
}): boolean {
  if (user.is_anonymous || user.email?.toLowerCase().endsWith('@viewer.tube.co.ke')) return false;
  return Boolean((user.phone && user.phone_confirmed_at) || (user.email && user.email_confirmed_at));
}
