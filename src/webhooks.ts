import { WazobiaError } from 'wazobiamail';

export const WEBHOOK_SIGNATURE_HEADER = 'x-wazobia-signature';

export class WazobiaWebhookError extends WazobiaError {
  constructor(message: string) {
    super(message);
    this.name = 'WazobiaWebhookError';
  }
}

export interface WazobiaWebhookEvent<TData = Record<string, unknown>> {
  id?: string;
  event?: string;
  type?: string;
  timestamp?: string;
  data?: TData;
  [key: string]: unknown;
}

const textEncoder = new TextEncoder();

function toBytes(payload: string | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof payload === 'string') {
    const encoded = textEncoder.encode(payload);
    return new Uint8Array(encoded);
  }
  return new Uint8Array(payload);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim();
  if (trimmed.toLowerCase().startsWith('sha256=')) {
    return trimmed.slice(7).trim().toLowerCase();
  }
  return trimmed.toLowerCase();
}

function constantTimeEqualHex(aHex: string, bHex: string): boolean {
  if (!/^[0-9a-f]+$/i.test(aHex) || !/^[0-9a-f]+$/i.test(bHex)) {
    return false;
  }
  const left = aHex.toLowerCase();
  const right = bHex.toLowerCase();
  if (left.length !== right.length || left.length === 0) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Computes the lowercase hex HMAC-SHA256 signature for a webhook payload using Web Crypto
 * (compatible with Next.js Node.js and Edge runtimes).
 */
export async function computeWebhookSignature(
  payload: string | Uint8Array,
  secret: string
): Promise<string> {
  if (!secret) {
    throw new WazobiaWebhookError('Webhook secret is required to compute a signature.');
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new WazobiaWebhookError('Web Crypto SubtleCrypto is unavailable in this runtime.');
  }

  const key = await subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await subtle.sign('HMAC', key, toBytes(payload));
  return bytesToHex(new Uint8Array(signatureBuffer));
}

export interface VerifyWebhookParams {
  payload: string | Uint8Array;
  signature: string | null | undefined;
  secret: string;
}

/**
 * Verifies a WazobiaMail webhook signature against the raw request body using constant-time comparison.
 * Accepts either raw hex or `sha256=<hex>` header values.
 */
export async function verifyWazobiaWebhook({
  payload,
  signature,
  secret,
}: VerifyWebhookParams): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  const normalized = normalizeSignature(signature);
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    return false;
  }

  const expected = await computeWebhookSignature(payload, secret);
  return constantTimeEqualHex(normalized, expected);
}

/**
 * Verifies the signature and parses the JSON webhook event payload.
 * Throws `WazobiaWebhookError` if verification or JSON parsing fails.
 */
export async function constructWebhookEvent<T = WazobiaWebhookEvent>(
  payload: string | Uint8Array,
  signature: string | null | undefined,
  secret: string
): Promise<T> {
  const valid = await verifyWazobiaWebhook({ payload, signature, secret });
  if (!valid) {
    throw new WazobiaWebhookError('Invalid WazobiaMail webhook signature.');
  }

  const rawText = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
  try {
    return JSON.parse(rawText) as T;
  } catch (err) {
    throw new WazobiaWebhookError(
      `Failed to parse webhook JSON payload: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export interface CreateWebhookHandlerOptions<T = WazobiaWebhookEvent> {
  /** Signing secret (`WAZOBIA_WEBHOOK_SECRET`). */
  secret?: string;
  /** Callback invoked after signature verification succeeds. */
  onEvent: (event: T, request: Request) => Promise<void> | void;
  /** Custom signature header name (defaults to `x-wazobia-signature`). */
  headerName?: string;
  /** Optional error hook invoked when event processing fails. */
  onError?: (error: Error) => void;
}

/**
 * Creates a Next.js App Router Route Handler (`export const POST = createWebhookHandler(...)`)
 * that verifies `X-Wazobia-Signature` against the exact raw request body.
 */
export function createWebhookHandler<T = WazobiaWebhookEvent>(
  options: CreateWebhookHandlerOptions<T>
): (request: Request) => Promise<Response> {
  const headerName = (options.headerName ?? WEBHOOK_SIGNATURE_HEADER).toLowerCase();

  return async (request: Request): Promise<Response> => {
    const secret = options.secret ?? process.env.WAZOBIA_WEBHOOK_SECRET ?? '';
    if (!secret) {
      return Response.json(
        { error: 'Webhook secret is not configured.' },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get(headerName);

    let event: T;
    try {
      event = await constructWebhookEvent<T>(rawBody, signature, secret);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : 'Invalid webhook payload' },
        { status: 401 }
      );
    }

    try {
      await options.onEvent(event, request);
      return Response.json({ received: true }, { status: 200 });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      options.onError?.(error);
      return Response.json(
        { error: 'Webhook handler error' },
        { status: 500 }
      );
    }
  };
}
