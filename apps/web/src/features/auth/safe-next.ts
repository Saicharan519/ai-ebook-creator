/**
 * Where to go after signing in. Only same-site paths are followed: a full URL
 * or "//other.site" in ?next= would turn the login page into an open redirect.
 */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/books";
}
