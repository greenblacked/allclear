import { createFileRoute } from "@tanstack/react-router";
import { BoardView } from "@/components/status/board-view";
import { fetchStatusBoard } from "@/lib/status/board";

export const Route = createFileRoute("/")({
  loader: () => fetchStatusBoard(),
  component: Home,
});

function Home() {
  const board = Route.useLoaderData();
  return <BoardView initial={board} />;
}
