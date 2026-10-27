import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "../../components/layout/Logo";

/** Form on the left; on wide screens, a manuscript page on the right sets the tone. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="self-start rounded-md">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="rise-in font-serif text-4xl font-medium tracking-[-0.02em] text-stone-900">
            {title}
          </h1>
          <p className="rise-in mt-2 text-sm text-stone-600">{subtitle}</p>
          <div className="rise-in mt-8">{children}</div>
        </div>
      </main>

      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden border-l border-stone-900/[0.07] bg-paper-deep lg:flex lg:items-center lg:justify-center"
      >
        <div className="w-[min(30rem,80%)] -rotate-[1deg] rounded-md bg-white px-12 pt-12 pb-16 shadow-page ring-1 ring-stone-900/[0.06]">
          <p className="text-xs font-medium tracking-[0.16em] text-stone-400 uppercase">
            Chapter 1
          </p>
          <p className="mt-2 font-serif text-3xl font-medium text-stone-900">Salt and Cinder</p>
          <div className="mt-8 space-y-4 font-serif text-[1.08rem] leading-[1.8] text-stone-700">
            <p>
              <span className="float-left mt-1 mr-2 font-serif text-[3.4rem] leading-[0.8] text-accent-700">
                T
              </span>
              he island kept its secrets the way the sea kept its dead: patiently, and never for
              long. Elspeth had known that since she was nine.
            </p>
            <p className="text-stone-400">
              Tonight the lamp would be lit again, and someone on the mainland would see it.
            </p>
          </div>
        </div>
        <p className="absolute bottom-8 left-1/2 w-max -translate-x-1/2 text-xs text-stone-500">
          Your words stay yours. Nothing is published until you choose to.
        </p>
      </aside>
    </div>
  );
}
