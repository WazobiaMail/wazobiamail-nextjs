import { defineConfig } from 'tsup';

const sharedExternal = [
  'next',
  'next/server',
  'next/headers',
  'react',
  'react-dom',
  'react-dom/server',
  '@react-email/render',
  'wazobiamail',
  'wazobiamail-react',
];

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      server: 'src/server.ts',
      webhooks: 'src/webhooks.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    target: 'es2022',
    external: sharedExternal,
  },
  {
    entry: {
      client: 'src/client.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    target: 'es2022',
    banner: {
      js: "'use client';",
    },
    external: sharedExternal,
  },
]);
