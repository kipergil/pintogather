/**
 * Builds a sign-in route that carries the current location along as a
 * `returnTo` param — app/(auth)/_layout.tsx reads it back once the session
 * becomes active and redirects there instead of the default "/", so tapping
 * "Sign in" from a shared map link, an invitation, or a follow/like prompt
 * doesn't strand the user back on the Maps tab afterwards.
 */
export function signInHref(returnTo: string): string {
  return `/(auth)/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
}
