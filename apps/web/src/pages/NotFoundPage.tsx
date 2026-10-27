import { Link } from "react-router";
import { Logo } from "../components/layout/Logo";

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <p className="font-serif text-7xl font-medium text-stone-300">404</p>
      <h1 className="font-serif text-3xl font-medium text-stone-900">
        This page was never written.
      </h1>
      <p className="max-w-sm text-stone-600">
        The link may be wrong, or the page may have moved. Your books are safe.
      </p>
      <Link
        to="/"
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-paper hover:bg-stone-800"
      >
        Go to the home page
      </Link>
    </main>
  );
}
