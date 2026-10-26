import { Navigate, Outlet, useLocation } from "react-router";
import { FullPageSpinner } from "../../components/ui/Spinner";
import { useAuth } from "./auth-context";

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

/** Layout route for the login and signup pages: signed-in users skip straight to their books. */
export function RedirectIfAuthenticated() {
  const { state } = useAuth();

  if (state.status === "loading") {
    return <FullPageSpinner />;
  }
  if (state.status === "authenticated") {
    return <Navigate to="/books" replace />;
  }
  return <Outlet />;
}
