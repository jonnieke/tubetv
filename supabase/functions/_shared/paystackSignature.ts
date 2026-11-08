const encoder = new TextEncoder();

async function verifyHmac(signature: string, body: Uint8Array<ArrayBuffer>, secret: string) {
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
  const digest = Uint8Array.from(signature.match(/../g)!, pair => parseInt(pair, 16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, digest, body);
}

export async function verifyPaystackWebhook(
  headers: Headers, body: Uint8Array<ArrayBuffer>, apiSecret: string,
  signingSecret?: string, now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!signingSecret) return verifyHmac(headers.get('x-paystack-signature') || '', body, apiSecret);

  const fields = (headers.get('Paystack-Signature') || '').split(',').map(field => field.trim());
  const timestamps = fields.filter(field => field.startsWith('t='));
  if (timestamps.length !== 1) return false;
  const timestamp = timestamps[0].slice(2);
  if (!/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300) return false;
  const prefix = encoder.encode(timestamp + '.');
  const signed = new Uint8Array(prefix.length + body.length);
  signed.set(prefix);
  signed.set(body, prefix.length);

  for (const field of fields) {
    const signature = field.match(/^v1=whk_[^:]+:([0-9a-f]{128})$/i)?.[1];
    if (signature && await verifyHmac(signature, signed, signingSecret)) return true;
  }
  return false;
}
