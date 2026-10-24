"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/ui";
import { computePeaks, fmtClock, placeholderPeaks } from "@/lib/waveform";

const BARS = 72;
const RATES = [1, 1.5, 2];

type State = "idle" | "loading" | "ready" | "error";

/**
 * Abspieler für Gesprächsaufnahmen mit Wellenform.
 * Die Aufnahme wird erst beim ersten Abspielen geladen (jeder Abruf wird serverseitig protokolliert);
 * bis dahin zeigt der Player eine gleichbleibende Platzhalter-Welle. Klick oder Pfeiltasten springen.
 */
export function WaveformPlayer({ src, seed, durationSec }: { src: string; seed: string; durationSec?: number | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);
  const pendingSeek = useRef<number | null>(null);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number>(durationSec ?? 0);
  const [rate, setRate] = useState(1);
  const placeholder = useMemo(() => placeholderPeaks(seed, BARS), [seed]);
  const bars = peaks ?? placeholder;
  const progress = duration > 0 ? Math.min(1, time / duration) : 0;

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const tick = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setTime(a.currentTime);
    if (!a.paused) rafRef.current = requestAnimationFrame(tick);
  }, []);

  const load = useCallback(async (): Promise<HTMLAudioElement | null> => {
    if (audioRef.current) return audioRef.current;
    setState("loading");
    setError(null);
    try {
      const r = await fetch(src, { cache: "no-store" });
      if (!r.ok) {
        const body = await r.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "Die Aufnahme konnte nicht geladen werden.");
      }
      const blob = await r.blob();
      urlRef.current = URL.createObjectURL(blob);
      const a = new Audio(urlRef.current);
      a.preload = "auto";
      a.addEventListener("loadedmetadata", () => { if (Number.isFinite(a.duration)) setDuration(a.duration); });
      a.addEventListener("play", () => { setPlaying(true); rafRef.current = requestAnimationFrame(tick); });
      a.addEventListener("pause", () => { setPlaying(false); cancelAnimationFrame(rafRef.current); setTime(a.currentTime); });
      a.addEventListener("ended", () => { setPlaying(false); setTime(a.duration || 0); });
      audioRef.current = a;
      setState("ready");
      // Echte Wellenform berechnen (ohne Erfolg bleibt der Platzhalter – Abspielen geht trotzdem)
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
          const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
          setPeaks(computePeaks(chans, BARS));
          if (!duration) setDuration(buf.duration);
          void ctx.close();
        }
      } catch {
        /* Format nicht dekodierbar – Platzhalter bleibt */
      }
      return a;
    } catch (e) {
      setState("error");
      setError((e as Error).message);
      return null;
    }
  }, [src, tick, duration]);

  async function toggle() {
    const a = await load();
    if (!a) return;
    if (pendingSeek.current != null) {
      a.currentTime = pendingSeek.current;
      pendingSeek.current = null;
    }
    a.playbackRate = rate;
    if (a.paused) await a.play().catch(() => setError("Abspielen wurde vom Browser blockiert."));
    else a.pause();
  }

  async function seekTo(sec: number) {
    const max = duration || 0;
    const t = Math.max(0, Math.min(max, sec));
    setTime(t);
    const a = audioRef.current;
    if (a) a.currentTime = t;
    else pendingSeek.current = t;
  }

  function onBarsClick(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    void seekTo(((e.clientX - r.left) / r.width) * (duration || 0));
  }

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") { e.preventDefault(); void seekTo(time + 5); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); void seekTo(time - 5); }
    else if (e.key === "Home") { e.preventDefault(); void seekTo(0); }
    else if (e.key === "End") { e.preventDefault(); void seekTo(duration); }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); void toggle(); }
  }

  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  return (
    <div className="glass-soft p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={state === "loading"}
          aria-label={playing ? "Pause" : "Aufnahme abspielen"}
          className="btn-primary grid h-11 w-11 shrink-0 place-items-center rounded-full p-0"
        >
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
        </button>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Position in der Aufnahme"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${fmtClock(time)} von ${fmtClock(duration)}`}
          onClick={onBarsClick}
          onKeyDown={onKey}
          className="group relative flex h-12 min-w-0 flex-1 cursor-pointer items-center gap-[2px] rounded-lg outline-none"
        >
          {bars.map((v, i) => {
            const played = (i + 0.5) / bars.length <= progress;
            return (
              <span
                key={i}
                className={cn("block min-w-[2px] flex-1 rounded-full transition-colors", played ? "bg-cyan-400" : peaks ? "bg-zinc-600/60" : "bg-zinc-600/35")}
                style={{ height: `${Math.max(8, v * 100)}%`, boxShadow: played ? "0 0 8px rgb(var(--acg) / var(--acg-alpha))" : undefined }}
              />
            );
          })}
          {duration > 0 && <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 rounded-full bg-zinc-50/80" style={{ left: `${progress * 100}%` }} />}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs font-semibold tabular-nums text-zinc-200">{fmtClock(time)} / {fmtClock(duration)}</span>
          <button type="button" onClick={cycleRate} className="chip border-zinc-700 text-zinc-400 hover:text-zinc-100" title="Abspielgeschwindigkeit">{rate.toLocaleString("de-DE")}×</button>
        </div>
      </div>
      {state === "idle" && <p className="mt-2 text-[11px] text-zinc-500">Die Aufnahme wird erst beim Abspielen geladen. Das Abspielen wird protokolliert.</p>}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
    </div>
  );
}
