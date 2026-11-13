# wazobiamail-nextjs

Official Next.js App Router, Pages Router, Server Actions, React Email, and Webhook SDK for [WazobiaMail](https://wazobiamail.com).

## Installation

```bash
npm install wazobiamail-nextjs wazobiamail wazobiamail-react
# Optional if building templates with React Email components:
npm install @react-email/components @react-email/render
```

Set your server secrets in `.env.local`:

```env
WAZOBIA_API_KEY=wzbm_live_...
WAZOBIA_WEBHOOK_SECRET=whsec_...
```

## Entrypoints

- `wazobiamail-nextjs/server` — server-only clients (`createWazobiaClient`, `getWazobiaClient`), `sendReactEmail`, and `createSendEmailAction` (throws if accidentally executed in a browser)
- `wazobiamail-nextjs/client` — `'use client'` boundary re-exporting `<WazobiaMailProvider>` and all hooks (`useSendMail`, `useMailbox`, `useDomains`, `useSpamCheck`)
- `wazobiamail-nextjs/webhooks` — constant-time HMAC-SHA256 webhook verification (`verifyWazobiaWebhook`, `constructWebhookEvent`, `createWebhookHandler`) compatible with Node.js and Edge runtimes
- `wazobiamail-nextjs` — isomorphic core client, error classes, and `renderEmail` / `sendReactEmail` helpers

## Usage

### App Router Route Handler (`app/api/send/route.tsx`)

```tsx
import { sendReactEmail } from 'wazobiamail-nextjs/server';
import { WelcomeEmail } from '@/emails/WelcomeEmail';

export async function POST(req: Request) {
  const { email, name } = await req.json();

  const res = await sendReactEmail({
    from: 'Acme <hello@acme.com>',
    to: email,
    subject: 'Welcome to Acme!',
    react: <WelcomeEmail name={name} />,
  });

  return Response.json(res.data);
}
```

### Server Action (`app/actions/send-email.ts`)

```ts
'use server';

import { createSendEmailAction } from 'wazobiamail-nextjs/server';

export const sendSupportEmail = createSendEmailAction({
  defaultFrom: 'support@acme.com',
});
```

### App Router Webhook Handler (`app/api/webhooks/wazobiamail/route.ts`)

Verifies `X-Wazobia-Signature` against the raw request body using constant-time HMAC-SHA256:

```ts
import { createWebhookHandler } from 'wazobiamail-nextjs/webhooks';

export const POST = createWebhookHandler({
  secret: process.env.WAZOBIA_WEBHOOK_SECRET,
  onEvent: async (event) => {
    console.log('Verified event:', event.type, event.data);
  },
});
```

### Client Components (`app/providers.tsx`)

```tsx
'use client';

import { WazobiaMailProvider } from 'wazobiamail-nextjs/client';

export function Providers({ children }: { children: React.ReactNode }) {
  return <WazobiaMailProvider baseUrl="/api/wazobia-proxy">{children}</WazobiaMailProvider>;
}
```

## License

MIT
