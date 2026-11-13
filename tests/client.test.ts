import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as clientExports from '../src/client';
import * as rootExports from '../src/index';

describe('wazobiamail-nextjs client & root exports', () => {
  it('exposes React hooks and Provider cleanly from client entrypoint', () => {
    expect(typeof clientExports.WazobiaMailProvider).toBe('function');
    expect(typeof clientExports.useWazobiaMail).toBe('function');
    expect(typeof clientExports.useSendMail).toBe('function');
    expect(typeof clientExports.useMailbox).toBe('function');
    expect(typeof clientExports.useDomains).toBe('function');
    expect(typeof clientExports.useSpamCheck).toBe('function');
  });

  it('does not expose server env factories from root index entrypoint', () => {
    expect(typeof rootExports.renderEmail).toBe('function');
    expect(typeof rootExports.sendReactEmail).toBe('function');
    expect((rootExports as Record<string, unknown>).createWazobiaClient).toBeUndefined();
    expect((rootExports as Record<string, unknown>).getWazobiaClient).toBeUndefined();
  });

  it('starts src/client.ts (and built dist/client.* when present) with "use client"', () => {
    const srcClient = readFileSync(resolve(import.meta.dir, '../src/client.ts'), 'utf8');
    expect(srcClient.startsWith("'use client';")).toBe(true);

    const distEsm = resolve(import.meta.dir, '../dist/client.js');
    if (existsSync(distEsm)) {
      expect(readFileSync(distEsm, 'utf8').startsWith("'use client';")).toBe(true);
    }

    const distCjs = resolve(import.meta.dir, '../dist/client.cjs');
    if (existsSync(distCjs)) {
      expect(readFileSync(distCjs, 'utf8').startsWith("'use client';")).toBe(true);
    }
  });
});
