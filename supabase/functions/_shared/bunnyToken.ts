const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generates a Bunny Stream HLS playlist URL.
 * When `BUNNY_TOKEN_AUTH_KEY` is configured, signs a directory-scoped V2 token
 * (`token_path=/{videoId}/`) so both `playlist.m3u8` and child `.ts`/`.m4s`
 * segment requests are authorized until `ttlSeconds` elapses.
 */
export async function buildBunnyPlaybackUrl(
  pullZone: string,
  videoId: string,
  tokenAuthKey?: string | null,
  ttlSeconds = 14400,
): Promise<{ url: string; signed: boolean; expiresAt: number | null }> {
  const cleanZone = pullZone.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const cleanKey = (tokenAuthKey || "").trim();

  if (!cleanKey) {
    return {
      url: `https://${cleanZone}/${videoId}/playlist.m3u8`,
      signed: false,
      expiresAt: null,
    };
  }

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const tokenPath = `/${videoId}/`;
  const hashable = `${cleanKey}${tokenPath}${expires}token_path=${tokenPath}`;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(hashable));
  const token = toBase64Url(new Uint8Array(digest));

  return {
    url: `https://${cleanZone}/bcdn_token=${token}&expires=${expires}&token_path=${encodeURIComponent(tokenPath)}/${videoId}/playlist.m3u8`,
    signed: true,
    expiresAt: expires * 1000,
  };
}

/**
 * Signs a Bunny CDN thumbnail/poster URL using a directory-scoped V2 token.
 * Rounds expiration to the nearest hour so browser and CDN caches stay warm.
 */
export async function buildBunnyAssetUrl(
  pullZone: string,
  assetPath: string,
  tokenAuthKey?: string | null,
  ttlSeconds = 86400,
): Promise<string> {
  const cleanZone = pullZone.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const cleanPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  const cleanKey = (tokenAuthKey || "").trim();
  if (!cleanZone) return "";
  if (!cleanKey) return `https://${cleanZone}${cleanPath}`;

  // Align expiry to hourly boundaries so identical thumbnail URLs cache cleanly across requests.
  const nowHour = Math.floor(Date.now() / 3600000) * 3600;
  const expires = nowHour + ttlSeconds;
  const lastSlash = cleanPath.lastIndexOf("/");
  const tokenPath = lastSlash > 0 ? cleanPath.slice(0, lastSlash + 1) : "/";
  const hashable = `${cleanKey}${tokenPath}${expires}token_path=${tokenPath}`;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(hashable));
  const token = toBase64Url(new Uint8Array(digest));

  return `https://${cleanZone}/bcdn_token=${token}&expires=${expires}&token_path=${encodeURIComponent(tokenPath)}${cleanPath}`;
}

/**
 * Generates Bunny Stream Direct TUS upload signature credentials:
 * sha256_hex(library_id + api_key + expiration_time + video_id)
 */
export async function buildBunnyTusUploadSignature(
  libraryId: string,
  apiKey: string,
  videoId: string,
  ttlSeconds = 7200,
): Promise<{
  endpoint: string;
  authorizationSignature: string;
  authorizationExpire: number;
  libraryId: string;
  videoId: string;
}> {
  const authorizationExpire = Math.floor(Date.now() / 1000) + ttlSeconds;
  const raw = `${libraryId}${apiKey}${authorizationExpire}${videoId}`;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  const authorizationSignature = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    endpoint: "https://video.bunnycdn.com/tusupload",
    authorizationSignature,
    authorizationExpire,
    libraryId,
    videoId,
  };
}

