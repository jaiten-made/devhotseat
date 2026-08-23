import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense } from "react";
import appCss from "../styles/app.css?url";

export interface RouterContext {
  queryClient: QueryClient;
}

/**
 * Devtools are loaded only in development, behind a dynamic import, so they do
 * not reach the production bundle.
 */
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : () => null;

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "devhotseat" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={router.options.context.queryClient}>
          {/*
            The bar is sticky because the two list screens grow without bound —
            a bank of forty questions should not strand you at the bottom of it
            with no way back to the sessions.
          */}
          <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-3xl items-stretch gap-8 px-6">
              <Link
                to="/"
                className="flex items-center text-[0.9375rem] font-semibold tracking-tight"
              >
                {/* The tool is named for the seat, not the dev in it. */}
                <span className="text-ink-faint">dev</span>
                <span>hotseat</span>
              </Link>
              <nav className="flex items-stretch gap-6">
                <NavLink to="/" exact>
                  Questions
                </NavLink>
                <NavLink to="/sessions">Sessions</NavLink>
                <NavLink to="/dashboard">Dashboard</NavLink>
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">{children}</main>

          <Suspense>
            <Devtools buttonPosition="bottom-right" />
          </Suspense>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Set in the data face, like every other label in the app that names a thing
 * rather than saying something. The active tab is marked by a rule sitting on
 * the bar's own bottom border, so the highlight belongs to the chrome rather
 * than tinting the word.
 *
 * `exact` is needed on the root link: without it "/" prefix-matches every
 * route, and both tabs light up at once.
 */
function NavLink({
  to,
  exact = false,
  children,
}: {
  to: string;
  exact?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="field-label relative flex items-center transition-colors hover:text-ink [&.active]:text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink after:opacity-0 [&.active]:after:opacity-100"
    >
      {children}
    </Link>
  );
}
