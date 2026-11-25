export const publicTags = new Set(['category','author','creator','description','tags','seriestitle','series','seriesid','seriessynopsis','seriesposterurl','seriestrailerurl','seasonsynopsis','episodesynopsis','season','episode','nextreleasedate','releasecadencedays','releasebatchsize','introendseconds','outrostartseconds','genre','productionyear','year','contentrating','classificationnumber','captionsurl','seriesformat','transcript','transcripturl','thumbnailurl','trailerurl','editorialupdatedat','accesstier','ispremium','freeepisodes','pricekes','featured']);
const COMPACT_OMIT_TAGS = new Set(['transcript', 'transcripturl']);
const COMPACT_TRIM_TAGS = new Set(['description', 'episodesynopsis', 'seriessynopsis', 'seasonsynopsis']);
const COMPACT_MAX_TEXT = 240;

function tagValue(tags: {property?: string; value?: string}[], name: string) {
  return tags.find(tag => tag.property?.toLowerCase() === name)?.value?.trim() || '';
}
export function publicItem(item: Record<string, unknown>, enforceRating = false, compact = false) {
  if (item.status !== 4) return null;
  const tags = Array.isArray(item.metaTags) ? item.metaTags as {property?: string; value?: string}[] : [];
  const category = tagValue(tags, 'category').toLowerCase();
  const rating = tagValue(tags, 'contentrating').toUpperCase();
  const published = tagValue(tags, 'published').toLowerCase();
  const releaseValue = tagValue(tags, 'releaseat');
  const releaseAt = Date.parse(releaseValue);
  if (!category || category === 'uncategorized') return null;
  if (tagValue(tags, 'muted').toLowerCase() === 'true' || published === 'false' || published === 'draft' || rating === '18') return null;
  if (enforceRating && !['GE','PG','16'].includes(rating)) return null;
  if (releaseValue && (!Number.isFinite(releaseAt) || releaseAt > Date.now())) return null;
  const filteredTags = tags
    .filter((tag) => {
      const key = String(tag.property || '').toLowerCase();
      if (!publicTags.has(key)) return false;
      if (compact && COMPACT_OMIT_TAGS.has(key)) return false;
      return true;
    })
    .map((tag) => {
      const key = String(tag.property || '').toLowerCase();
      const rawVal = typeof tag.value === 'string' ? tag.value : String(tag.value ?? '');
      const value =
        compact && COMPACT_TRIM_TAGS.has(key) && rawVal.length > COMPACT_MAX_TEXT
          ? `${rawVal.slice(0, COMPACT_MAX_TEXT - 1).trimEnd()}…`
          : tag.value;
      return { property: tag.property, value };
    });
  return {
    guid: item.guid, title: item.title, length: item.length, views: item.views,
    status: item.status, encodeProgress: item.encodeProgress, thumbnailFileName: item.thumbnailFileName,
    dateUploaded: item.dateUploaded, storageSize: item.storageSize, collectionId: item.collectionId,
    metaTags: filteredTags,
  };
}
