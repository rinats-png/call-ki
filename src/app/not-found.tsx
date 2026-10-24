import Link from "next/link";

export const metadata = { title: "Seite nicht gefunden" };

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="window max-w-md p-8 text-center">
        <p className="text-5xl font-extrabold">404</p>
        <h1 className="mt-3 text-xl font-bold">Seite nicht gefunden</h1>
        <p className="mt-2 text-sm text-zinc-400">Die Adresse gibt es nicht (mehr) oder Sie haben keinen Zugriff darauf.</p>
        <Link href="/" className="btn-primary mt-6 inline-flex">Zur Übersicht</Link>
      </div>
    </main>
  );
}
