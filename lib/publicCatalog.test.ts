import { describe, expect, it } from 'vitest';
import { publicItem } from '../supabase/functions/_shared/publicCatalog';

const item = (extra: {status?: number; metaTags?: {property:string;value:string}[]} = {}) => ({
  guid: 'video-id', title: 'Test story', status: 4, length: 85, views: 3,
  thumbnailFileName: 'thumbnail.jpg', dateUploaded: '2026-01-01',
  metaTags: [{property:'category',value:'Micro Dramas'},{property:'contentRating',value:'PG'}],
  ...extra,
});

describe('public catalogue projection', () => {
  it('excludes unfinished, hidden, draft, adult and future releases', () => {
    expect(publicItem(item({status:2}))).toBeNull();
    expect(publicItem(item({metaTags:[{property:'muted',value:'true'}]}))).toBeNull();
    expect(publicItem(item({metaTags:[{property:'published',value:'draft'}]}))).toBeNull();
    expect(publicItem(item({metaTags:[{property:'contentRating',value:'18'}]}))).toBeNull();
    expect(publicItem(item({metaTags:[{property:'releaseAt',value:'2099-01-01T00:00:00Z'}]}))).toBeNull();
  });
  it('drops private or control tags and can enforce classification', () => {
    const projected = publicItem(item({metaTags:[
      {property:'category',value:'Micro Dramas'},
      {property:'internalNotes',value:'private'},
      {property:'contentRating',value:'PG'},
      {property:'published',value:'processing'},
    ]}), true);
    expect(projected?.metaTags).toEqual([{property:'category',value:'Micro Dramas'},{property:'contentRating',value:'PG'}]);
    expect(publicItem(item({metaTags:[]}), true)).toBeNull();
  });
});
