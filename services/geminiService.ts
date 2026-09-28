import { supabase } from '../lib/supabase';
import type { Caption, DailyStat } from '../types';

async function adminAssist(action: 'metadata' | 'thumbnail', input: string): Promise<Record<string, unknown> | null> {
  if (!import.meta.env.VITE_SUPABASE_URL) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, input: input.slice(0, 500) }),
  });
  if (!response.ok) return null;
  return await response.json();
}

export async function generateVideoMetadata(fileName: string, fileSize: number) {
  const result = await adminAssist('metadata', `${fileName.slice(0, 200)} (${fileSize} bytes)`);
  return { title: String(result?.title || fileName), description: String(result?.description || '') };
}

export async function generateThumbnail(prompt: string): Promise<string | null> {
  const result = await adminAssist('thumbnail', prompt);
  return typeof result?.image === 'string' ? result.image : null;
}

// These are deliberately unavailable until measured data and verified captions exist.
export async function generateAnalyticsInsights(_data: DailyStat[]) { return 'Measured viewing trends are not available yet.'; }
export async function generateVideoSpecificInsights(_title: string, _metrics: { views: number; retention: number; ctr: number }) { return 'Measured retention and click-through data are not available yet.'; }
export async function generateCaptions(_title: string, _category: string): Promise<Caption[]> { return []; }
