import { Hono } from 'hono';
import { errors, type JWTVerifyGetKey, jwtVerify } from 'jose';

/** What a token must match: issuer (`iss`), client (`azp`) and the issuer's public keys (JWKS). */
export type VerifierConfig = {
  readonly issuer: string;
  readonly clientId: string;
  readonly keys: JWTVerifyGetKey;
};

const BEARER = /^Bearer (\S+)$/i;

const realmRoles = (claim: unknown): readonly string[] => {
  const roles = (claim as { roles?: unknown } | undefined)?.roles;
  return Array.isArray(roles) ? roles.filter((role) => typeof role === 'string') : [];
};

// Percent-encoded: header values must be ASCII, and names have accents.
const textClaim = (claim: unknown) => (typeof claim === 'string' ? encodeURIComponent(claim) : '');

/**
 * Token verifier called by Traefik ForwardAuth on `/verify` (ADR 0007).
 * Valid token: 204 with the `X-User-*` identity headers. Otherwise: 401, and since any non-2xx
 * response is returned to the client, the request stops at the gateway.
 */
export const createApp = ({ issuer, clientId, keys }: VerifierConfig) =>
  new Hono()
    .get('/health', (c) => c.json({ status: 'ok' }))
    .all('/verify', async (c) => {
      const token = BEARER.exec(c.req.header('authorization') ?? '')?.[1];
      const verified = token
        ? await jwtVerify(token, keys, {
            issuer,
            algorithms: ['RS256'],
            requiredClaims: ['exp', 'sub'],
          }).catch((error) => {
            // An unreachable JWKS is an outage, not a bad token.
            if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) {
              return undefined;
            }
            throw error;
          })
        : undefined;
      // azp: the Passaporte UFMS issues tokens to other systems too.
      if (!verified?.payload.sub || verified.payload.azp !== clientId) {
        c.header('WWW-Authenticate', 'Bearer');
        return c.json({ error: 'unauthorized' }, 401);
      }
      c.header('X-User-Id', verified.payload.sub);
      c.header('X-User-Roles', realmRoles(verified.payload.realm_access).join(','));
      c.header('X-User-Name', textClaim(verified.payload.name));
      c.header('X-User-Email', textClaim(verified.payload.email));
      return c.body(null, 204);
    });
