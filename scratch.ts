import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const BASE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/bunny-api` : '';

async function testUpdate() {
  console.log('Testing Bunny Update via Proxy...');
  console.log('BASE_URL:', BASE_URL);

  // We need a video ID to test. We can fetch the list first.
  const listRes = await fetch(`${BASE_URL}?page=1&itemsPerPage=1&orderBy=date`, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`
    }
  });

  if (!listRes.ok) {
    console.error('List failed:', await listRes.text());
    return;
  }
  const listData = await listRes.json();
  if (listData.items.length === 0) {
    console.log('No videos found.');
    return;
  }

  const video = listData.items[0];
  console.log('Testing update on video:', video.guid, video.title);

  // Append a dummy tag
  const metaTags = video.metaTags || [];
  const testTags = [...metaTags.filter(t => t.property !== 'test_tag'), { property: 'test_tag', value: 'hello_world' }];

  const updateRes = await fetch(`${BASE_URL}/${video.guid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify({
      metaTags: testTags
    })
  });

  if (!updateRes.ok) {
    console.error('Update failed:', await updateRes.text());
    return;
  }
  
  console.log('Update successful!', await updateRes.json());
}

testUpdate();
