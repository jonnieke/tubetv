export const publicTags = new Set(['category','author','creator','description','tags','seriestitle','series','seriesid','seriessynopsis','seasonsynopsis','episodesynopsis','season','episode','introendseconds','outrostartseconds','genre','productionyear','year','contentrating','classificationnumber','captionsurl','seriesformat','transcript','transcripturl','thumbnailurl','trailerurl','featuredinbanner','banner']);
function tagValue(tags: {property?: string; value?: string}[], name: string) {
  return tags.find(tag => tag.property?.toLowerCase() === name)?.value?.trim() || '';
}
export function publicItem(item: Record<string, unknown>, enforceRating = false) {
  if (item.status !== 4) return null;
  const tags = Array.isArray(item.metaTags) ? item.metaTags as {property?: string; value?: string}[] : [];
  const rating = tagValue(tags, 'contentrating').toUpperCase();
  const published = tagValue(tags, 'published').toLowerCase();
  const releaseValue = tagValue(tags, 'releaseat');
  const releaseAt = Date.parse(releaseValue);
  if (tagValue(tags, 'muted').toLowerCase() === 'true' || published === 'false' || published === 'draft' || rating === '18') return null;
  if (enforceRating && !['GE','PG','16'].includes(rating)) return null;
  if (releaseValue && (!Number.isFinite(releaseAt) || releaseAt > Date.now())) return null;
  return {
    guid: item.guid, title: item.title, length: item.length, views: item.views,
    status: item.status, encodeProgress: item.encodeProgress, thumbnailFileName: item.thumbnailFileName,
    dateUploaded: item.dateUploaded, storageSize: item.storageSize, collectionId: item.collectionId,
    metaTags: tags.filter(tag => publicTags.has(String(tag.property || '').toLowerCase())).map(tag => ({property: tag.property, value: tag.value})),
  };
}
