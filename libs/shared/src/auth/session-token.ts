import { createHmac, timingSafeEqual } from "crypto";
import { PrincipalRole, SERVICE_ROLE } from "./roles";

/** Cookie Directory sets on login; every frontend and API shares it (one parent domain). */
export const SESSION_COOKIE = "mms_session";

/** A signed-in staff member (or, with role SERVICE, a calling service). */
export interface AuthUser {
  id: string;
  name: string;
  role: PrincipalRole;
  locationCode: string | null;
  /** Set after an admin reset: only the change-password route is allowed. */
  mustChangePassword: boolean;
  /** Bumped by Directory on deactivation/reset/role change; Directory's /auth/me rejects a stale one. */
  sessionVersion: number;
}

interface TokenClaims extends AuthUser {
  iat: number;
  exp: number;
}

/** One shift. There is no refresh token: after this the user signs in again. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SERVICE_TTL_SECONDS = 5 * 60;
const DEV_SECRET = "mms-dev-only-secret-do-not-use-in-production";

// Fixed header: verification compares against these exact bytes, so a token
// claiming any other algorithm (including "none") can never verify.
const HEADER = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

/**
 * AUTH_JWT_SECRET is shared by every service (HS256). Outside production a
 * fixed dev secret keeps local setups working; in production a missing or
 * short secret is a startup error rather than a silently forgeable token.
 */
export function authSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET must be set to at least 32 characters in production");
  }
  return DEV_SECRET;
}

export function signSessionToken(
  user: AuthUser,
  ttlSeconds = SESSION_TTL_SECONDS,
  now = Date.now(),
): string {
  const iat = Math.floor(now / 1000);
  const claims: TokenClaims = { ...user, iat, exp: iat + ttlSeconds };
  const body = `${HEADER}.${base64url(JSON.stringify(claims))}`;
  return `${body}.${sign(body)}`;
}

/** The token's user, or null when it is malformed, tampered with or expired. */
export function verifySessionToken(token: string, now = Date.now()): AuthUser | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== HEADER) return null;

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let claims: TokenClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as TokenClaims;
  } catch {
    return null;
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;

  return {
    id: claims.id,
    name: claims.name,
    role: claims.role,
    locationCode: claims.locationCode ?? null,
    mustChangePassword: Boolean(claims.mustChangePassword),
    sessionVersion: claims.sessionVersion ?? 0,
  };
}

let cachedServiceToken: { token: string; expiresAt: number } | undefined;

/** Short-lived token for service-to-service REST calls, reused until a minute before expiry. */
export function serviceToken(now = Date.now()): string {
  if (cachedServiceToken && cachedServiceToken.expiresAt - 60_000 > now) {
    return cachedServiceToken.token;
  }
  const name = process.env.SERVICE_NAME ?? "internal";
  const token = signSessionToken(
    {
      id: `service:${name}`,
      name,
      role: SERVICE_ROLE,
      locationCode: null,
      mustChangePassword: false,
      sessionVersion: 0,
    },
    SERVICE_TTL_SECONDS,
    now,
  );
  cachedServiceToken = { token, expiresAt: now + SERVICE_TTL_SECONDS * 1000 };
  return token;
}

/** `fetch` for calls to another MMS service — carries this service's token. */
export function internalFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${serviceToken()}`);
  return fetch(url, { ...init, headers });
}

function sign(input: string): string {
  return createHmac("sha256", authSecret()).update(input).digest("base64url");
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}
