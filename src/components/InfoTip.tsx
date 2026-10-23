"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info, X, ExternalLink } from "lucide-react";

/**
 * Info-Symbol mit Anleitung. Klick öffnet ein kleines Fenster mit Schritten und optionalem Doku-Link.
 * Texte dürfen `code` in Backticks enthalten.
 */
export function InfoTip({ title, steps, link, className }: { title?: string; steps: string[]; link?: { href: string; label?: string }; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className ?? ""}`}>
      <button
        type="button"
        aria-label={title ? `Hilfe: ${title}` : "Hilfe"}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span id={id} role="dialog" className="absolute left-0 top-6 z-50 block w-[min(22rem,80vw)] rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-left text-xs font-normal leading-relaxed text-zinc-300 shadow-xl">
          <span className="mb-2 flex items-start justify-between gap-2">
            <span className="font-semibold text-zinc-100">{title ?? "So geht’s"}</span>
            <button type="button" aria-label="Schließen" className="text-zinc-500 hover:text-zinc-200" onClick={(e) => { e.preventDefault(); setOpen(false); }}><X className="h-3.5 w-3.5" /></button>
          </span>
          <ol className="list-decimal space-y-1 pl-4">
            {steps.map((s, i) => <li key={i}>{renderInline(s)}</li>)}
          </ol>
          {link?.href && (
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-cyan-300 hover:underline">
              {link.label ?? "Dokumentation"} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </span>
      )}
    </span>
  );
}

function renderInline(s: string) {
  return s.split(/(`[^`]+`)/).map((part, i) => (part.startsWith("`") ? <code key={i} className="rounded bg-zinc-800 px-1 font-mono text-[11px] text-zinc-200">{part.slice(1, -1)}</code> : part));
}
