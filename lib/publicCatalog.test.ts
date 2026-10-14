import { describe, expect, it } from 'vitest';
import { publicItem } from '../supabase/functions/_shared/publicCatalog';

const item = (extra: {guid?: string; title?: string; status?: number; metaTags?: {property:string;value:string}[]} = {}) => ({
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
  it('exposes authored season and skip-cue metadata to viewers', () => {
    const projected = publicItem(item({metaTags:[
      {property:'category',value:'Series'}, {property:'contentRating',value:'PG'},
      {property:'seasonSynopsis',value:'A new beginning.'},
      {property:'seriesPosterUrl',value:'https://cdn.example.com/show.jpg'},
      {property:'seriesTrailerUrl',value:'https://cdn.example.com/trailer.mp4'},
      {property:'editorialUpdatedAt',value:'2026-09-28T12:00:00.000Z'},
      {property:'introEndSeconds',value:'45'}, {property:'outroStartSeconds',value:'700'},
    ]}));
    expect(projected?.metaTags).toEqual(expect.arrayContaining([
      {property:'seasonSynopsis',value:'A new beginning.'},
      {property:'seriesPosterUrl',value:'https://cdn.example.com/show.jpg'},
      {property:'seriesTrailerUrl',value:'https://cdn.example.com/trailer.mp4'},
      {property:'editorialUpdatedAt',value:'2026-09-28T12:00:00.000Z'},
      {property:'introEndSeconds',value:'45'}, {property:'outroStartSeconds',value:'700'},
    ]));
  });
  it('correctly projects single item payloads', () => {
    const single = item({ guid: '12345678-1234-1234-1234-123456789abc', title: 'Single Episode' });
    const projected = publicItem(single);
    expect(projected).not.toBeNull();
    expect(projected?.guid).toBe('12345678-1234-1234-1234-123456789abc');
    expect(projected?.title).toBe('Single Episode');
  });
});
