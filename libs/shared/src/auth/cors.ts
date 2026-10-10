/**
 * CORS for every service. Browsers call the APIs with the session cookie, so
 * the origin must be on an allowlist (credentials rule out `*`).
 *
 * CORS_ORIGINS is a comma-separated list; `*` matches one hostname label or
 * a port, e.g. `https://*.example.com` or `http://localhost:*` (the default).
 */
export function corsOptions() {
  const patterns = (process.env.CORS_ORIGINS ?? "http://localhost:*")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map(originPattern);

  return {
    credentials: true,
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) =>
      // No Origin header: same-origin, curl, or a server-to-server call.
      callback(null, !origin || patterns.some((re) => re.test(origin))),
  };
}

export function originPattern(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[A-Za-z0-9-]+");
  return new RegExp(`^${escaped}$`);
}
