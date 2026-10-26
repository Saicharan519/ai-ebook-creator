import { BookOpenText, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAuth, useCurrentUser } from "../../features/auth/auth-context";
import { Button } from "../ui/Button";

export function AppHeader({ children }: { children?: ReactNode }) {
  const user = useCurrentUser();
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link to="/books" className="flex items-center gap-2 text-stone-900">
          <BookOpenText className="h-5 w-5 text-violet-600" />
          <span className="hidden font-semibold sm:inline">AI eBook Creator</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
        <span className="hidden text-sm text-stone-600 md:inline">{user.name}</span>
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}
