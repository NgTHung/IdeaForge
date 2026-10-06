"use client";

export default function BoardError({ reset }: { reset: () => void }) {
  return <main className="p-8"><h1 className="text-2xl font-bold">Could not join this canvas</h1>
    <p className="my-4">Check the connection and Liveblocks configuration, then try again.</p>
    <button className="button" onClick={reset}>Try again</button></main>;
}
