import { supabase } from '../lib/supabase';
import type { Caption, DailyStat } from '../types';

async function adminAssist(
  action: 'metadata' | 'thumbnail',
  input: string
): Promise<{ data: Record<string, unknown> | null; error?: string }> {
  if (!import.meta.env.VITE_SUPABASE_URL) return { data: null, error: 'Supabase is not configured.' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: 'Sign in as an admin to use AI assist.' };
  if (session.user?.app_metadata?.role !== 'admin') {
    return { data: null, error: 'AI assist requires an admin account. Fill in the fields manually below.' };
  }
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, input: input.slice(0, 500) }),
  });
  if (!response.ok) {
    return {
      data: null,
      error: response.status === 403
        ? 'AI assist returned 403 (admin verification required). You can fill in the fields manually.'
        : 'AI assist is temporarily unavailable.',
    };
  }
  return { data: await response.json() };
}

export async function generateVideoMetadata(fileName: string, fileSize: number) {
  const { data, error } = await adminAssist('metadata', `${fileName.slice(0, 200)} (${fileSize} bytes)`);
  return { title: String(data?.title || fileName), description: String(data?.description || ''), error };
}

export async function generateThumbnail(prompt: string): Promise<string | null> {
  const { data } = await adminAssist('thumbnail', prompt);
  return typeof data?.image === 'string' ? data.image : null;
}

// These are deliberately unavailable until measured data and verified captions exist.
export async function generateAnalyticsInsights(_data: DailyStat[]) { return 'Measured viewing trends are not available yet.'; }
export async function generateVideoSpecificInsights(_title: string, _metrics: { views: number; retention: number; ctr: number }) { return 'Measured retention and click-through data are not available yet.'; }
export async function generateCaptions(_title: string, _category: string): Promise<Caption[]> { return []; }
