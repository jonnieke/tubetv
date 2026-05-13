/** Strip HTML tags and trim whitespace from a string. Returns undefined for falsy input. */
export const sanitizeText = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  return value.replace(/<[^>]*>/g, '').trim();
};

/** Apply sanitizeText to all string fields of a metadata object. */
export const sanitizeMetadata = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = typeof v === 'string' ? sanitizeText(v) : v;
  }
  return result as T;
};
