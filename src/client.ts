'use client';

export {
  WazobiaMailContext,
  WazobiaMailProvider,
  useWazobiaMail,
  useSendMail,
  useMailbox,
  useDomains,
  useSpamCheck,
} from 'wazobiamail-react';

export type {
  WazobiaMailProviderProps,
  UseSendMailOptions,
  UseSendMailReturn,
  UseMailboxOptions,
  UseMailboxReturn,
  UseDomainsOptions,
  UseDomainsReturn,
  UseSpamCheckOptions,
  UseSpamCheckReturn,
} from 'wazobiamail-react';

export {
  WazobiaError,
  WazobiaApiError,
  WazobiaAuthenticationError,
  WazobiaForbiddenError,
  WazobiaNotFoundError,
  WazobiaValidationError,
  WazobiaRateLimitError,
  WazobiaTimeoutError,
} from 'wazobiamail-react';
