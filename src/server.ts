import type { ReactElement } from 'react';
import {
  WazobiaError,
  WazobiaMail,
  WazobiaApiError,
  WazobiaAuthenticationError,
  WazobiaForbiddenError,
  WazobiaNotFoundError,
  WazobiaValidationError,
  WazobiaRateLimitError,
  WazobiaTimeoutError,
  type SendMessageRequest,
  type SendMessageResponse,
  type WazobiaClientOptions,
} from 'wazobiamail';
import {
  renderEmail,
  htmlToPlainText,
  sendReactEmail as dispatchReactEmail,
  type RenderEmailOptions,
  type RenderedEmail,
  type SendReactEmailOptions,
  type SendReactEmailPayload,
} from 'wazobiamail-react';

export {
  WazobiaMail,
  WazobiaError,
  WazobiaApiError,
  WazobiaAuthenticationError,
  WazobiaForbiddenError,
  WazobiaNotFoundError,
  WazobiaValidationError,
  WazobiaRateLimitError,
  WazobiaTimeoutError,
  renderEmail,
  htmlToPlainText,
};
export type {
  RenderEmailOptions,
  RenderedEmail,
  SendReactEmailOptions,
  SendReactEmailPayload,
};

let cachedDefaultClient: WazobiaMail | null = null;

function assertServerRuntime(): void {
  if (typeof window !== 'undefined') {
    throw new WazobiaError(
      'wazobiamail-nextjs/server must only run on the server. Use wazobiamail-nextjs/client for browser hooks and providers.'
    );
  }
}

/**
 * Creates a fresh server-side `WazobiaMail` client, automatically falling back to
 * `process.env.WAZOBIA_API_KEY` / `process.env.WAZOBIAMAIL_API_KEY` and `process.env.WAZOBIA_BASE_URL`.
 */
export function createWazobiaClient(
  options?: string | WazobiaClientOptions
): WazobiaMail {
  assertServerRuntime();

  if (typeof options === 'string') {
    return new WazobiaMail({ apiKey: options });
  }

  const apiKey =
    options?.apiKey ??
    process.env.WAZOBIA_API_KEY ??
    process.env.WAZOBIAMAIL_API_KEY;
  const baseUrl = options?.baseUrl ?? process.env.WAZOBIA_BASE_URL;

  return new WazobiaMail({
    ...options,
    apiKey,
    baseUrl,
  });
}

/**
 * Returns a cached singleton `WazobiaMail` client configured from server environment variables,
 * or creates a dedicated instance when explicit `options` are provided.
 */
export function getWazobiaClient(options?: WazobiaClientOptions): WazobiaMail {
  assertServerRuntime();

  if (options) {
    return createWazobiaClient(options);
  }

  if (!cachedDefaultClient) {
    cachedDefaultClient = createWazobiaClient();
  }

  return cachedDefaultClient;
}

/**
 * Clears the cached singleton server client (primarily useful in automated tests).
 */
export function resetWazobiaClient(): void {
  cachedDefaultClient = null;
}

export interface ServerSendReactEmailOptions extends SendReactEmailOptions {
  /** Optional explicit `WazobiaMail` client instance. */
  client?: WazobiaMail;
  /** Optional client options used when creating a client on demand. */
  clientOptions?: WazobiaClientOptions;
}

/**
 * Renders a React Email or JSX element on the Next.js server and dispatches it via WazobiaMail.
 */
export async function sendReactEmail(
  payload: SendReactEmailPayload,
  options: ServerSendReactEmailOptions = {}
): Promise<SendMessageResponse> {
  assertServerRuntime();
  const client = options.client ?? getWazobiaClient(options.clientOptions);
  return dispatchReactEmail(client, payload, {
    idempotencyKey: options.idempotencyKey,
    renderOptions: options.renderOptions,
  });
}

export type SendEmailActionInput =
  | (SendMessageRequest & { react?: undefined })
  | (Omit<SendReactEmailPayload, 'react'> & { react?: ReactElement });

export type SendEmailActionResult =
  | { ok: true; data: SendMessageResponse['data'] }
  | { ok: false; error: string };

export interface CreateSendEmailActionOptions {
  client?: WazobiaMail;
  clientOptions?: WazobiaClientOptions;
  /** Default sender address merged when `input.from` is omitted. */
  defaultFrom?: string;
  renderOptions?: RenderEmailOptions;
}

/**
 * Builds a serializable handler suitable for Next.js Server Actions (`'use server'`).
 */
export function createSendEmailAction(
  defaults: CreateSendEmailActionOptions = {}
): (input: SendEmailActionInput) => Promise<SendEmailActionResult> {
  assertServerRuntime();

  return async (input: SendEmailActionInput): Promise<SendEmailActionResult> => {
    try {
      const client = defaults.client ?? getWazobiaClient(defaults.clientOptions);
      const from = input.from ?? defaults.defaultFrom;

      const response = input.react
        ? await dispatchReactEmail(
            client,
            { ...(input as SendReactEmailPayload), from, react: input.react },
            { renderOptions: defaults.renderOptions }
          )
        : await client.messages.send({ ...(input as SendMessageRequest), from });

      return { ok: true, data: response.data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}
