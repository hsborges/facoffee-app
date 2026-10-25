import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const issuer = 'http://localhost:8080/realms/facoffee';
const clientId = 'facoffee-web';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const other = await generateKeyPair('RS256');
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: 'RS256' }] });

const app = createApp({ issuer, clientId, keys });

const sign = (claims: JWTPayload = {}, key = privateKey) =>
  new SignJWT({
    iss: issuer,
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + 300,
    azp: clientId,
    realm_access: { roles: ['gestor', 'participante'] },
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(key);

const verify = (authorization?: string) =>
  app.request('/verify', authorization ? { headers: { authorization } } : {});

describe('GET /verify', () => {
  it('204 with the user id and roles for a valid token', async () => {
    const response = await verify(`Bearer ${await sign()}`);
    expect(response.status).toBe(204);
    expect(response.headers.get('x-user-id')).toBe('user-1');
    expect(response.headers.get('x-user-roles')).toBe('gestor,participante');
  });

  it('empty roles when the token has none', async () => {
    const response = await verify(`Bearer ${await sign({ realm_access: undefined })}`);
    expect(response.status).toBe(204);
    expect(response.headers.get('x-user-roles')).toBe('');
  });

  it('401 without a bearer token', async () => {
    for (const authorization of [undefined, 'Basic abc', 'Bearer ']) {
      const response = await verify(authorization);
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    }
  });

  it('401 for a forged, expired, foreign or malformed token', async () => {
    const tokens = [
      await sign({}, other.privateKey),
      await sign({ exp: Math.floor(Date.now() / 1000) - 60 }),
      await sign({ iss: 'https://other.example' }),
      await sign({ azp: 'other-client' }),
      await sign({ azp: undefined }),
      'not-a-jwt',
    ];
    for (const token of tokens) expect((await verify(`Bearer ${token}`)).status).toBe(401);
  });
});

describe('GET /health', () => {
  it('200', async () => {
    expect((await app.request('/health')).status).toBe(200);
  });
});
