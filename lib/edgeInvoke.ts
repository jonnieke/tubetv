import { supabase } from './supabase';

/**
 * Invokes a Supabase Edge Function and always returns the JSON payload,
 * even when the function replies with a non-2xx status (supabase-js hides those bodies behind a generic error).
 */
export async function invokeEdge<T = Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<T & { ok?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (data && typeof data === 'object') return data as T & { ok?: boolean; error?: string };
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const parsed = await ctx.clone().json();
          if (parsed && typeof parsed === 'object') return parsed as T & { ok?: boolean; error?: string };
        } catch {
          // fall through
        }
      }
      return { ok: false, error: 'The service is unavailable right now. Please try again.' } as T & { ok?: boolean; error?: string };
    }
    return { ok: false, error: 'Empty response from service.' } as T & { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' } as T & { ok?: boolean; error?: string };
  }
}
