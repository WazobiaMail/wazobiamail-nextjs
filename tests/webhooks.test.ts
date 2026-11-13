import { describe, it, expect, mock } from 'bun:test';
import {
  WEBHOOK_SIGNATURE_HEADER,
  WazobiaWebhookError,
  computeWebhookSignature,
  verifyWazobiaWebhook,
  constructWebhookEvent,
  createWebhookHandler,
} from '../src/webhooks';

describe('wazobiamail-nextjs/webhooks', () => {
  const secret = 'whsec_test_super_secret_123';
  const payload = JSON.stringify({
    id: 'evt_123',
    type: 'message.delivered',
    data: { trackingId: 'trk_123', recipient: 'ada@example.com' },
  });

  it('verifies valid raw hex and sha256= prefixed HMAC-SHA256 signatures', async () => {
    const sig = await computeWebhookSignature(payload, secret);

    expect(await verifyWazobiaWebhook({ payload, signature: sig, secret })).toBe(true);
    expect(await verifyWazobiaWebhook({ payload, signature: `sha256=${sig}`, secret })).toBe(true);
    expect(
      await verifyWazobiaWebhook({ payload, signature: `SHA256=${sig.toUpperCase()}`, secret })
    ).toBe(true);

    const bytes = new TextEncoder().encode(payload);
    expect(await verifyWazobiaWebhook({ payload: bytes, signature: sig, secret })).toBe(true);
  });

  it('rejects tampered payloads, wrong secrets, and malformed signatures', async () => {
    const sig = await computeWebhookSignature(payload, secret);

    expect(await verifyWazobiaWebhook({ payload: `${payload} `, signature: sig, secret })).toBe(
      false
    );
    expect(await verifyWazobiaWebhook({ payload, signature: sig, secret: 'wrong-secret' })).toBe(
      false
    );
    expect(await verifyWazobiaWebhook({ payload, signature: '', secret })).toBe(false);
    expect(await verifyWazobiaWebhook({ payload, signature: 'not-valid-hex', secret })).toBe(false);
    expect(await verifyWazobiaWebhook({ payload, signature: null, secret })).toBe(false);
  });

  it('constructWebhookEvent validates signature and parses typed JSON', async () => {
    const sig = await computeWebhookSignature(payload, secret);
    const evt = await constructWebhookEvent<{ id: string; type: string }>(payload, sig, secret);
    expect(evt.id).toBe('evt_123');
    expect(evt.type).toBe('message.delivered');

    await expect(constructWebhookEvent(payload, 'bad', secret)).rejects.toThrow(WazobiaWebhookError);

    const badJson = '{not-json';
    const badJsonSig = await computeWebhookSignature(badJson, secret);
    await expect(constructWebhookEvent(badJson, badJsonSig, secret)).rejects.toThrow(
      WazobiaWebhookError
    );
  });

  it('createWebhookHandler returns 200 for valid signed Next.js App Router Requests and 401/500 on failures', async () => {
    const onEvent = mock(async () => {});
    const handler = createWebhookHandler({ secret, onEvent });
    const sig = await computeWebhookSignature(payload, secret);

    const validRequest = new Request('https://app.example.com/api/webhooks/wazobiamail', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [WEBHOOK_SIGNATURE_HEADER]: `sha256=${sig}`,
      },
      body: payload,
    });

    const okResponse = await handler(validRequest);
    expect(okResponse.status).toBe(200);
    expect(await okResponse.json()).toEqual({ received: true });
    expect(onEvent).toHaveBeenCalledTimes(1);

    const invalidRequest = new Request('https://app.example.com/api/webhooks/wazobiamail', {
      method: 'POST',
      headers: {
        [WEBHOOK_SIGNATURE_HEADER]: 'deadbeef',
      },
      body: payload,
    });

    const unauthorizedResponse = await handler(invalidRequest);
    expect(unauthorizedResponse.status).toBe(401);

    const throwingHandler = createWebhookHandler({
      secret,
      onEvent: async () => {
        throw new Error('DB down');
      },
    });
    const errorRequest = new Request('https://app.example.com/api/webhooks/wazobiamail', {
      method: 'POST',
      headers: { [WEBHOOK_SIGNATURE_HEADER]: sig },
      body: payload,
    });
    const errResponse = await throwingHandler(errorRequest);
    expect(errResponse.status).toBe(500);
  });
});
