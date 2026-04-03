import crypto from 'crypto';

interface R2Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

function readConfig(): R2Config | null {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const region = process.env.R2_REGION?.trim() || 'auto';

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint: endpoint.replace(/\/+$/, ''), bucket, accessKeyId, secretAccessKey, region };
}

function sha256Hex(input: Buffer | string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function isoDate(now: Date): { amzDate: string; dateStamp: string } {
  const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = now.getUTCDate().toString().padStart(2, '0');
  const hh = now.getUTCHours().toString().padStart(2, '0');
  const mi = now.getUTCMinutes().toString().padStart(2, '0');
  const ss = now.getUTCSeconds().toString().padStart(2, '0');
  const dateStamp = `${yyyy}${mm}${dd}`;
  return { amzDate: `${dateStamp}T${hh}${mi}${ss}Z`, dateStamp };
}

function encodeS3Path(key: string): string {
  return key
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
}

async function signedFetch(
  method: 'PUT' | 'DELETE',
  key: string,
  body?: Buffer,
  contentType = 'application/octet-stream',
): Promise<void> {
  const cfg = readConfig();
  if (!cfg) throw new Error('R2 config missing');

  const now = new Date();
  const { amzDate, dateStamp } = isoDate(now);
  const service = 's3';
  const scope = `${dateStamp}/${cfg.region}/${service}/aws4_request`;
  const host = new URL(cfg.endpoint).host;
  const canonicalUri = `/${cfg.bucket}/${encodeS3Path(key)}`;
  const payloadHash = body ? sha256Hex(body) : sha256Hex('');

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest =
    `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${cfg.endpoint}${canonicalUri}`, {
    method,
    headers: {
      Host: host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
      ...(method === 'PUT' ? { 'Content-Type': contentType } : {}),
    },
    body: method === 'PUT' ? body : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`R2 ${method} failed (${res.status}): ${err.slice(0, 400)}`);
  }
}

export function isR2Enabled(): boolean {
  return readConfig() !== null;
}

export async function uploadTempObjectToR2(key: string, bytes: Buffer): Promise<void> {
  await signedFetch('PUT', key, bytes, 'video/mp4');
}

export async function deleteTempObjectFromR2(key: string): Promise<void> {
  await signedFetch('DELETE', key);
}

