"use client";

import Link from "next/link";

/** Fehlerseite (500): keine technischen Details an Nutzer, nur die Referenz für den Support. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="window max-w-md p-8 text-center">
        <p className="text-5xl font-extrabold">Ups</p>
        <h1 className="mt-3 text-xl font-bold">Da ist etwas schiefgelaufen</h1>
        <p className="mt-2 text-sm text-zinc-400">Bitte versuchen Sie es erneut. Bleibt der Fehler, nennen Sie dem Support diese Referenz{error.digest ? <>: <code className="font-mono">{error.digest}</code></> : "."}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-primary" onClick={reset}>Erneut versuchen</button>
          <Link href="/" className="btn-ghost">Zur Übersicht</Link>
        </div>
      </div>
    </main>
  );
}
