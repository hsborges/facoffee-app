import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

// GATEWAY_HTTPS_PORT: the gateway's HTTPS port on the host, from the environment or infra/.env,
// as in infra/docker-compose.dev.yml (default 443).
const { GATEWAY_HTTPS_PORT } = loadEnv(
  '',
  fileURLToPath(new URL('../infra', import.meta.url)),
  'GATEWAY_',
);

export default defineConfig({
  server: {
    // Same origin as the gateway, which has no CORS (ADR 0019); its local certificate is self-signed.
    proxy: {
      '/api': { target: `https://localhost:${GATEWAY_HTTPS_PORT || '443'}`, secure: false },
    },
  },
});
