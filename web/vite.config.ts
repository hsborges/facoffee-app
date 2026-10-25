import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Same origin as the gateway, which has no CORS (ADR 0019); its local certificate is self-signed.
    proxy: { '/api': { target: 'https://localhost', secure: false } },
  },
});
