import { createFileRoute } from "@tanstack/react-router";
import { getStatusBoard } from "@/lib/status/board";
import { atomFeed, PUBLIC_HEADERS } from "@/lib/status/integrations";

// GET /feed.xml: an Atom feed of the services that need attention.
export const Route = createFileRoute("/feed.xml")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        new Response(atomFeed(await getStatusBoard(), new URL(request.url).origin), {
          headers: { ...PUBLIC_HEADERS, "Content-Type": "application/atom+xml; charset=utf-8" },
        }),
    },
  },
});
