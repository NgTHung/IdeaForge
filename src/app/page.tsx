import { LocalBoard } from "@/components/local-board";

export const dynamic = "force-dynamic";

export default function Home() {
  return <LocalBoard collaborationEnabled={Boolean(process.env.LIVEBLOCKS_SECRET_KEY)} />;
}
