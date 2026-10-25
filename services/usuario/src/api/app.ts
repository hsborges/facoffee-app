import { Hono } from 'hono';
import { perfisDos, type Usuario } from '../domain/usuario.js';

/**
 * HTTP API of the Usuário context. `GET /eu` returns the logged-in user (ADR 0008).
 * Identity comes from the gateway (ADR 0007); name and email arrive percent-encoded.
 */
export const app = new Hono()
  .get('/health', (c) => c.json({ status: 'ok' }))
  .get('/eu', (c) => {
    const id = c.req.header('x-user-id');
    if (!id) return c.json({ error: 'unauthorized' }, 401);
    const usuario: Usuario = {
      id,
      nome: decodeURIComponent(c.req.header('x-user-name') ?? ''),
      email: decodeURIComponent(c.req.header('x-user-email') ?? ''),
      perfis: perfisDos((c.req.header('x-user-roles') ?? '').split(',')),
    };
    return c.json(usuario);
  });
