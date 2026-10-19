/**
 * Links in emails are always built on this pinned origin, never on the request's Host header (which an
 * attacker controls). Set BETTER_AUTH_URL in production; without it production falls back to the live site.
 */
export const BASE_URL =
  process.env.BETTER_AUTH_URL ?? (process.env.NODE_ENV === "production" ? "https://taskora-kappa-seven.vercel.app" : "http://localhost:3000");
