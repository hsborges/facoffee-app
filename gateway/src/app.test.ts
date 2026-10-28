import {
  createLocalJWKSet,
  errors,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  SignJWT,
} from 'jose';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const issuer = 'http://localhost:8080/realms/facoffee';
const clientId = 'facoffee-web';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const other = await generateKeyPair('RS256');
const pss = await generateKeyPair('PS256');
const keys = createLocalJWKSet({
  keys: [
    { ...(await exportJWK(publicKey)), alg: 'RS256' },
    { ...(await exportJWK(pss.publicKey)), alg: 'PS256' },
  ],
});

const app = createApp({ issuer, clientId, keys });

const sign = (claims: JWTPayload = {}, key = privateKey, alg = 'RS256') =>
  new SignJWT({
    iss: issuer,
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + 300,
    azp: clientId,
    realm_access: { roles: ['gestor', 'participante'] },
    name: 'João Café',
    email: 'joao@ufms.br',
    ...claims,
  })
    .setProtectedHeader({ alg })
    .sign(key);

const verify = (authorization?: string) =>
  app.request('/verify', authorization ? { headers: { authorization } } : {});

describe('GET /verify', () => {
  it('204 with the user id and roles for a valid token', async () => {
    const response = await verify(`Bearer ${await sign()}`);
    expect(response.status).toBe(204);
    expect(response.headers.get('x-user-id')).toBe('user-1');
    expect(response.headers.get('x-user-roles')).toBe('gestor,participante');
    expect(response.headers.get('x-user-name')).toBe('Jo%C3%A3o%20Caf%C3%A9');
    expect(response.headers.get('x-user-email')).toBe('joao%40ufms.br');
  });

  it('empty roles, name and email when the token has none', async () => {
    const response = await verify(
      `Bearer ${await sign({ realm_access: undefined, name: undefined, email: undefined })}`,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('x-user-roles')).toBe('');
    expect(response.headers.get('x-user-name')).toBe('');
    expect(response.headers.get('x-user-email')).toBe('');
  });

  it('401 without a bearer token', async () => {
    for (const authorization of [undefined, 'Basic abc', 'Bearer ']) {
      const response = await verify(authorization);
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
      expect(await response.json()).toEqual({ error: 'nao-autenticado' });
    }
  });

  it('401 for a forged, expired, foreign or malformed token', async () => {
    const tokens = [
      await sign({}, other.privateKey),
      await sign({ exp: Math.floor(Date.now() / 1000) - 60 }),
      await sign({ iss: 'https://other.example' }),
      await sign({ azp: 'other-client' }),
      await sign({ azp: undefined }),
      await sign({}, pss.privateKey, 'PS256'),
      'not-a-jwt',
    ];
    for (const token of tokens) expect((await verify(`Bearer ${token}`)).status).toBe(401);
  });
});

describe('GET /verify with the JWKS unreachable', () => {
  it('500, not 401, so an outage is not mistaken for a bad token', async () => {
    const unreachable = () => Promise.reject(new errors.JWKSTimeout());
    const response = await createApp({ issuer, clientId, keys: unreachable }).request('/verify', {
      headers: { authorization: `Bearer ${await sign()}` },
    });
    expect(response.status).toBe(500);
  });
});

describe('GET /health', () => {
  it('200', async () => {
    expect((await app.request('/health')).status).toBe(200);
  });
});
