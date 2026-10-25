import { serve } from '@hono/node-server';
import { createRemoteJWKSet } from 'jose';
import { createApp } from './app.js';

const { OIDC_ISSUER, OIDC_JWKS_URL, OIDC_CLIENT_ID, PORT = '3000' } = process.env;
if (!OIDC_ISSUER || !OIDC_JWKS_URL || !OIDC_CLIENT_ID) {
  console.error('OIDC_ISSUER, OIDC_JWKS_URL and OIDC_CLIENT_ID must be set');
  process.exit(1);
}

const app = createApp({
  issuer: OIDC_ISSUER,
  clientId: OIDC_CLIENT_ID,
  keys: createRemoteJWKSet(new URL(OIDC_JWKS_URL)),
});
const server = serve({ fetch: app.fetch, port: Number(PORT) });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
