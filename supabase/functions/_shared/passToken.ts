const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SignedPassPayload {
  subId: string;
  tier: string;
  exp: number; // Unix timestamp in milliseconds
  ref: string;
}

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

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function constantTimeSecretEquals(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);
  if (viewA.length !== viewB.length) return false;
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i] ^ viewB[i];
  }
  return diff === 0;
}

function getSigningSecret(): string {
  return Deno.env.get("PASS_SIGNING_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function issuePassToken(payload: SignedPassPayload): Promise<string> {
  const secret = getSigningSecret();
  if (!secret) throw new Error("Pass signing secret is not configured.");
  const payloadSegment = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadSegment));
  return `${payloadSegment}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyPassToken(token: string): Promise<SignedPassPayload | null> {
  const secret = getSigningSecret();
  if (!secret || !token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [payloadSegment, signatureSegment] = parts;
  const signatureBytes = fromBase64Url(signatureSegment);
  const payloadBytes = fromBase64Url(payloadSegment);
  if (!signatureBytes || !payloadBytes) return null;

  try {
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(payloadSegment),
    );
    if (!valid) return null;
    const parsed = JSON.parse(decoder.decode(payloadBytes)) as SignedPassPayload;
    if (
      !parsed ||
      typeof parsed.subId !== "string" ||
      typeof parsed.tier !== "string" ||
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

