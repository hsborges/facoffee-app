import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Same origin as the gateway, which has no CORS (ADR 0019); its local certificate is self-signed.
    // GATEWAY_HTTPS_PORT: the gateway's HTTPS port on the host, as in infra/docker-compose.dev.yml.
    proxy: {
      '/api': {
        target: `https://localhost:${process.env.GATEWAY_HTTPS_PORT ?? '443'}`,
        secure: false,
      },
    },
  },
});
