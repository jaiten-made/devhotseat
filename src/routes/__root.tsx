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
      { title: "dev-hotseat" },
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
          <div className="mx-auto max-w-3xl px-6 py-10">
            <header className="mb-10 flex items-baseline gap-6 border-b pb-4">
              <Link to="/" className="font-semibold tracking-tight">
                dev-hotseat
              </Link>
              <nav className="flex gap-4 text-sm text-muted-foreground">
                <Link
                  to="/"
                  className="hover:text-foreground [&.active]:text-foreground"
                >
                  Questions
                </Link>
                <Link
                  to="/sessions"
                  className="hover:text-foreground [&.active]:text-foreground"
                >
                  Sessions
                </Link>
              </nav>
            </header>
            {children}
          </div>
          <Suspense>
            <Devtools buttonPosition="bottom-right" />
          </Suspense>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
