/** Public artwork and trailer links must be absolute HTTPS URLs, never executable schemes. */
export function publicMediaUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
