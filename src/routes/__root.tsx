import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "AllClear";

function RootDocument() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <html lang="en" className="dark antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg font-sans text-fg">
        <PreviewHostBridge />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

const DESCRIPTION =
  "Live status board for GCP, AWS, Steam, CS2 Europe, Epic, Fortnite, Spotify, Apple, Android, Grok, ChatGPT, Claude, MikroTik RouterOS, and Apple OS. Official sources checked on open, then every 2 minutes.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: DESCRIPTION },
      { name: "theme-color", content: "#0c1018" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: APP_NAME },
      { property: "og:site_name", content: APP_NAME },
      { property: "og:description", content: DESCRIPTION },
      { name: "twitter:card", content: "summary" },
      // og:image and og:url are deliberately absent: scrapers resolve them
      // against nothing, so they need the deployed origin spelled out, and
      // this repository does not record one yet. Add them, pointing at the
      // existing public/og.jpg (1200x630), once the board has a canonical URL.
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      // Dropped: /__grok/manifest.webmanifest and /__grok/icon-180.png were
      // left over from a hosting template. Neither file exists in public/,
      // so both 404 on every page load.
    ],
  }),
  component: RootDocument,
});
