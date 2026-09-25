import { createFileRoute } from "@tanstack/react-router";
import { getStatusBoard } from "@/lib/status/board";
import { PUBLIC_HEADERS, shieldsBadge } from "@/lib/status/integrations";

// GET /api/badge/<service-id> or /api/badge/board: a Shields.io endpoint badge.
// https://img.shields.io/endpoint?url=<origin>/api/badge/gcp renders it.
export const Route = createFileRoute("/api/badge/$service")({
  server: {
    handlers: {
      GET: async ({ params }) =>
        Response.json(shieldsBadge(await getStatusBoard(), params.service), { headers: PUBLIC_HEADERS }),
    },
  },
});
