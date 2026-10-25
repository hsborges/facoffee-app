import { Hono } from 'hono';
import { errors, type JWTVerifyGetKey, jwtVerify } from 'jose';

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

// Traefik ForwardAuth target: any non-2xx response is returned to the client and the request stops.
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
      return c.body(null, 204);
    });
