import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  WazobiaError,
  WazobiaMail,
  createWazobiaClient,
  getWazobiaClient,
  resetWazobiaClient,
  sendReactEmail,
  createSendEmailAction,
} from '../src/server';

function OrderConfirmation({ orderId }: { orderId: string }) {
  return (
    <section>
      <h1>Order #{orderId}</h1>
      <p>Thank you for shopping with Acme.</p>
    </section>
  );
}

describe('wazobiamail-nextjs/server', () => {
  const originalEnv = { ...process.env };
  const hadWindow = 'window' in globalThis;
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    resetWazobiaClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetWazobiaClient();
    if (!hadWindow) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  });

  it('reads WAZOBIA_API_KEY and caches default singleton client', () => {
    process.env.WAZOBIA_API_KEY = 'wzbm_next_server_key';
    process.env.WAZOBIA_BASE_URL = 'https://custom.wazobiamail.test/api/v1';

    const first = getWazobiaClient();
    const second = getWazobiaClient();
    const explicit = createWazobiaClient({ apiKey: 'wzbm_override_key' });

    expect(first).toBeInstanceOf(WazobiaMail);
    expect(first).toBe(second);
    expect(explicit).not.toBe(first);
  });

  it('refuses to run inside a browser environment', () => {
    (globalThis as any).window = {};
    expect(() => createWazobiaClient('wzbm_key')).toThrow(WazobiaError);
    expect(() => getWazobiaClient()).toThrow(WazobiaError);
  });

  it('renders React Email templates and sends via explicit or env client', async () => {
    const client = new WazobiaMail('wzbm_server_mock');
    const sendSpy = mock(async () => ({
      success: true,
      message: 'Queued',
      data: { result: { trackingId: 'trk_next_1', status: 'queued', recipients: 1 } },
    }));
    client.messages.send = sendSpy as any;

    const response = await sendReactEmail(
      {
        from: 'orders@acme.com',
        to: 'buyer@example.com',
        subject: 'Order Confirmation',
        react: <OrderConfirmation orderId="9001" />,
      },
      { client, idempotencyKey: 'order-9001' }
    );

    expect(response.data.result.trackingId).toBe('trk_next_1');
    const payload = sendSpy.mock.calls[0]?.[0] as any;
    expect(payload.html).toContain('<h1>Order #9001</h1>');
    expect(payload.text).toContain('Order #9001');
    expect(sendSpy.mock.calls[0]?.[1]).toEqual({ idempotencyKey: 'order-9001' });
  });

  it('createSendEmailAction handles defaultFrom and returns serializable Server Action results', async () => {
    const client = new WazobiaMail('wzbm_action_mock');
    client.messages.send = mock(async (req: any) => {
      if (req.subject === 'fail') {
        throw new Error('Upstream validation failed');
      }
      return {
        success: true,
        message: 'Queued',
        data: { result: { trackingId: `trk_${req.from}`, status: 'queued', recipients: 1 } },
      };
    }) as any;

    const sendEmail = createSendEmailAction({
      client,
      defaultFrom: 'noreply@acme.com',
    });

    const okResult = await sendEmail({
      to: 'buyer@example.com',
      subject: 'Welcome',
      react: <OrderConfirmation orderId="77" />,
    });

    expect(okResult.ok).toBe(true);
    if (okResult.ok) {
      expect(okResult.data.result.trackingId).toBe('trk_noreply@acme.com');
    }

    const errResult = await sendEmail({
      to: 'buyer@example.com',
      subject: 'fail',
      html: '<p>Hi</p>',
    });

    expect(errResult).toEqual({
      ok: false,
      error: 'Upstream validation failed',
    });
  });
});
