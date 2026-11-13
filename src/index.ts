// Client-safe React Email helpers
export { renderEmail, sendReactEmail, htmlToPlainText } from 'wazobiamail-react';

export type {
  RenderEmailOptions,
  RenderedEmail,
  SendReactEmailPayload,
  SendReactEmailOptions,
} from 'wazobiamail-react';

// Core Client, Errors, and Models
export {
  WazobiaMail,
  Wazobia,
  WazobiaError,
  WazobiaApiError,
  WazobiaAuthenticationError,
  WazobiaForbiddenError,
  WazobiaNotFoundError,
  WazobiaValidationError,
  WazobiaRateLimitError,
  WazobiaTimeoutError,
} from 'wazobiamail';

export type * from 'wazobiamail';
