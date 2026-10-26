import { Navigate, Outlet, useLocation, useSearchParams } from "react-router";
import { FullPageSpinner } from "../../components/ui/Spinner";
import { useAuth } from "./auth-context";
import { safeNext } from "./safe-next";

/** Layout route: renders child routes only for signed-in users. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "loading") {
    return <FullPageSpinner />;
  }
  if (state.status === "anonymous") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/**
 * Layout route for the login and signup pages. Once a session exists (already
 * signed in, or just signed in on this page) it sends the user on to ?next=
 * or their books. This is the only place that redirects after signing in.
 */
export function RedirectIfAuthenticated() {
  const { state } = useAuth();
  const [searchParams] = useSearchParams();

  if (state.status === "loading") {
    return <FullPageSpinner />;
  }
  if (state.status === "authenticated") {
    return <Navigate to={safeNext(searchParams.get("next"))} replace />;
  }
  return <Outlet />;
}
