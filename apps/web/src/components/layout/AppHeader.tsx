import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAuth, useCurrentUser } from "../../features/auth/auth-context";
import { Button } from "../ui/Button";
import { Logo, LogoMark } from "./Logo";

/**
 * The bar above signed-in pages. `children` fills the middle (the editor puts
 * the book title and actions there); without them the full wordmark shows.
 */
export function AppHeader({ children }: { children?: ReactNode }) {
  const user = useCurrentUser();
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-900/[0.07] bg-paper/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link to="/books" aria-label="Your books" className="rounded-md">
          {children ? <LogoMark /> : <Logo />}
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
        <span
          className="hidden h-7 w-7 items-center justify-center rounded-md bg-paper-deep text-xs font-semibold text-stone-700 ring-1 ring-stone-900/10 md:flex"
          title={user.name}
          aria-hidden="true"
        >
          {user.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <Button variant="ghost" size="sm" onClick={() => void logout()} aria-label="Log out">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}
