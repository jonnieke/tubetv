const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type RewardUnlockSource = "ad" | "share" | "streak";

export interface SignedRewardPayload {
  grantId: string;
  videoId: string;
  source: RewardUnlockSource;
  deviceId: string;
  exp: number; // Unix timestamp in milliseconds
}

const TOKEN_PREFIX = "rw1";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function getSigningSecret(): string {
  return Deno.env.get("PASS_SIGNING_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`reward:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function issueRewardToken(payload: SignedRewardPayload): Promise<string> {
  const secret = getSigningSecret();
  if (!secret) throw new Error("Reward signing secret is not configured.");
  const payloadSegment = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${TOKEN_PREFIX}.${payloadSegment}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyRewardToken(token: string): Promise<SignedRewardPayload | null> {
  const secret = getSigningSecret();
  if (!secret || !token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const [, payloadSegment, signatureSegment] = parts;
  const signatureBytes = fromBase64Url(signatureSegment);
  const payloadBytes = fromBase64Url(payloadSegment);
  if (!signatureBytes || !payloadBytes) return null;

  try {
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(`${TOKEN_PREFIX}.${payloadSegment}`),
    );
    if (!valid) return null;

    const parsed = JSON.parse(decoder.decode(payloadBytes)) as SignedRewardPayload;
    if (
      !parsed ||
      typeof parsed.grantId !== "string" ||
      typeof parsed.videoId !== "string" ||
      typeof parsed.deviceId !== "string" ||
      (parsed.source !== "ad" && parsed.source !== "share" && parsed.source !== "streak") ||
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
