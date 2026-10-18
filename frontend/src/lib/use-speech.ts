"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { openMic, type Mic, type Recorder } from "@/lib/voice/recorder";
import { synthesize, transcribe } from "@/lib/voice/api";

/*
 * Speech I/O behind one hook so the provider can change. Hearing and speaking go through the
 * Taskora FastAPI backend (Sarvam saaras:v4 / bulbul:v4-flash); if speaking fails it falls back
 * to the browser voice. `levelRef` (0..1) carries live loudness — mic while listening, reply audio
 * while speaking — so the avatar can move without re-rendering React.
 *
 * Built for back-and-forth talk:
 * - the mic stays open for `keepMicMs` after a take, so the next turn starts instantly;
 * - a reply is spoken clip by clip (first sentence, the rest, the follow-up) and every clip is
 *   fetched at once, so the first words play while the rest are still being made;
 * - decoded clips are cached by text, so repeated phrases ("Anything else?") play instantly;
 * - `speak()` resolves true when the whole reply played, false if it was cut off;
 * - each turn's timings are logged to the console as `[taskora] turn …`.
 */

export type SpeechMode = "idle" | "listening" | "thinking" | "speaking";

export type SpeechOptions = {
  /** Keep the mic open this long after a take (0 = release at once). */
  keepMicMs?: number;
  /** A take opened with `noSpeechMs` heard nobody and was dropped. */
  onNoSpeech?: () => void;
};

const CACHE_MAX = 40;

/** First sentence on its own (it plays first), the rest together. */
export function splitForSpeech(text: string): string[] {
  const t = text.trim();
  const m = t.match(/^([\s\S]+?[.!?])\s+([\s\S]+)$/);
  if (!m || m[1].length < 12) return t ? [t] : [];
  return [m[1], m[2]];
}

export function useSpeech(onFinal?: (text: string) => void, maxSeconds = 20, keyterms: string[] = [], options: SpeechOptions = {}) {
  const { getToken } = useAuth();
  const micRef = useRef<Mic | null>(null);
  const micTimer = useRef<number | undefined>(undefined);
  const recRef = useRef<Recorder | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const cbRef = useRef(onFinal);
  const termsRef = useRef(keyterms);
  const optsRef = useRef(options);
  const levelRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const cache = useRef(new Map<string, Promise<AudioBuffer>>());
  const playRef = useRef<{ stop: () => void } | null>(null);
  const runId = useRef(0); // lets a newer speak() cancel an older one mid-flight
  const sttId = useRef(0); // same for transcription (kept apart so speaking a reply does not cancel it)
  const turn = useRef<{ stoppedAt: number; sttMs?: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preparing, setPreparing] = useState(false); // reply text is ready, audio is on its way
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // playback trouble, shown without hiding the reply

  useEffect(() => {
    cbRef.current = onFinal;
    termsRef.current = keyterms;
    optsRef.current = options;
  });
  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof AudioWorkletNode !== "undefined",
    );
  }, []);

  const audioCtx = useCallback(() => {
    ctxRef.current ??= new AudioContext();
    void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  /** Decoded audio for one phrase; cached by text (failures are not cached). */
  const clip = useCallback(
    (text: string) => {
      const hit = cache.current.get(text);
      if (hit) {
        cache.current.delete(text); // refresh its place in the LRU order
        cache.current.set(text, hit);
        return hit;
      }
      const p = (async () => {
        const t0 = performance.now();
        const bytes = await synthesize(text, await getToken());
        const buffer = await audioCtx().decodeAudioData(bytes);
        console.info(`[taskora] tts ${Math.round(performance.now() - t0)} ms · ${text.length} chars · "${text.slice(0, 40)}"`);
        return buffer;
      })();
      p.catch(() => cache.current.delete(text));
      cache.current.set(text, p);
      while (cache.current.size > CACHE_MAX) cache.current.delete(cache.current.keys().next().value!);
      return p;
    },
    [audioCtx, getToken],
  );

  /** Warm the cache for phrases that are likely to be spoken soon (split the way speak() splits). */
  const prefetch = useCallback((texts: string[]) => texts.flatMap(splitForSpeech).forEach((t) => void clip(t).catch(() => {})), [clip]);

  const stopPlayback = useCallback(() => {
    runId.current++;
    playRef.current?.stop();
    playRef.current = null;
    window.speechSynthesis?.cancel();
    levelRef.current = 0;
    setSpeaking(false);
    setPreparing(false);
  }, []);

  const releaseMic = useCallback(() => {
    window.clearTimeout(micTimer.current);
    if (recRef.current) return; // never pull the mic out from under a live take
    micRef.current?.close();
    micRef.current = null;
  }, []);

  const scheduleRelease = useCallback(() => {
    window.clearTimeout(micTimer.current);
    micTimer.current = window.setTimeout(releaseMic, optsRef.current.keepMicMs ?? 0);
  }, [releaseMic]);

  const endTake = useCallback(() => {
    window.clearInterval(timer.current);
    const rec = recRef.current;
    recRef.current = null;
    setListening(false);
    scheduleRelease();
    return rec;
  }, [scheduleRelease]);

  const stop = useCallback(async () => {
    const rec = endTake();
    if (!rec) return;
    const id = ++sttId.current;
    setProcessing(true);
    turn.current = { stoppedAt: performance.now() };
    try {
      const wav = await rec.finish();
      const out = await transcribe(wav, await getToken(), termsRef.current);
      if (id !== sttId.current) return;
      if (turn.current) turn.current.sttMs = performance.now() - turn.current.stoppedAt;
      const text = out.text.trim();
      setTranscript(text);
      if (text) cbRef.current?.(text);
    } catch (e) {
      const why = e instanceof Error ? e.message : "network error";
      if (id === sttId.current) setError(`I couldn't hear that (${why}). Try again.`);
    } finally {
      if (id === sttId.current) setProcessing(false);
    }
  }, [endTake, getToken]);

  /** Drop the current take without transcribing it. */
  const cancel = useCallback(() => {
    endTake()?.cancel();
  }, [endTake]);

  const stopRef = useRef(stop);
  const cancelRef = useRef(cancel);
  useEffect(() => {
    stopRef.current = stop;
    cancelRef.current = cancel;
  }, [stop, cancel]);

  /** Open a take. `noSpeechMs` drops it quietly if nobody starts talking in time (hands-free). */
  const start = useCallback(
    async ({ noSpeechMs }: { noSpeechMs?: number } = {}) => {
      stopPlayback();
      sttId.current++; // a new take cancels any transcription still in flight
      setProcessing(false);
      audioCtx(); // unlock playback while we still have the tap that started this
      setError(null);
      setTranscript("");
      setSeconds(0);
      turn.current = null;
      window.clearTimeout(micTimer.current);
      try {
        if (!micRef.current || micRef.current.closed) micRef.current = await openMic();
      } catch {
        setError("Microphone is blocked. Allow it in the browser and try again.");
        return;
      }
      recRef.current?.cancel();
      recRef.current = micRef.current.take({
        onLevel: (l) => (levelRef.current = l),
        onSilence: () => void stopRef.current(),
        noSpeechMs,
        onNoSpeech: () => {
          cancelRef.current();
          optsRef.current.onNoSpeech?.();
        },
      });
      setListening(true);
      const startedAt = Date.now();
      timer.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(s);
        if (s >= maxSeconds) void stopRef.current();
      }, 250);
    },
    [audioCtx, maxSeconds, stopPlayback],
  );

  const speakWithBrowser = useCallback((text: string, id: number) => {
    return new Promise<boolean>((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth || id !== runId.current) return resolve(false);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-IN";
      let raf = 0;
      const wiggle = () => {
        levelRef.current = 0.25 + 0.35 * Math.abs(Math.sin(performance.now() / 110)); // no real signal; fake mouth
        raf = requestAnimationFrame(wiggle);
      };
      u.onstart = () => {
        setPreparing(false);
        setSpeaking(true);
        wiggle();
      };
      const end = (ok: boolean) => () => {
        cancelAnimationFrame(raf);
        levelRef.current = 0;
        setSpeaking(false);
        resolve(ok && id === runId.current);
      };
      u.onend = end(true);
      u.onerror = end(false);
      synth.cancel();
      synth.speak(u);
    });
  }, []);

  /** Play one decoded clip through the shared analyser; resolves when it ends or is stopped. */
  const play = useCallback((ctx: AudioContext, buffer: AudioBuffer, id: number) => {
    return new Promise<boolean>((resolve) => {
      if (id !== runId.current) return resolve(false);
      analyserRef.current ??= (() => {
        const a = ctx.createAnalyser();
        a.fftSize = 512;
        a.connect(ctx.destination);
        return a;
      })();
      const analyser = analyserRef.current;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const b of data) sum += ((b - 128) / 128) ** 2;
        levelRef.current = levelRef.current * 0.5 + Math.min(Math.sqrt(sum / data.length) * 5, 1) * 0.5;
        raf = requestAnimationFrame(tick);
      };
      const finish = (ok: boolean) => {
        cancelAnimationFrame(raf);
        src.disconnect();
        levelRef.current = 0;
        resolve(ok);
      };
      src.onended = () => finish(id === runId.current);
      playRef.current = {
        stop: () => {
          src.onended = null;
          try {
            src.stop();
          } catch {}
          finish(false);
        },
      };
      src.start();
      tick();
    });
  }, []);

  /**
   * Speak a reply. Pass several parts (e.g. answer + follow-up question) to have each cached and
   * played in order; long parts are split so the first sentence starts sooner.
   */
  const speak = useCallback(
    async (parts: string | string[]) => {
      stopPlayback();
      const id = ++runId.current;
      const clips = (Array.isArray(parts) ? parts : [parts]).flatMap(splitForSpeech);
      if (!clips.length) return true;
      setPreparing(true);
      const t0 = performance.now();
      const pending = clips.map((c) => clip(c)); // all in flight at once; played in order
      pending.forEach((p) => p.catch(() => {}));
      let ctx: AudioContext;
      try {
        ctx = audioCtx();
        await ctx.resume();
        if (ctx.state !== "running") throw new Error("audio is locked by the browser");
      } catch (e) {
        setNotice(`Voice playback failed (${e instanceof Error ? e.message : "unknown"}); using the browser voice.`);
        return speakWithBrowser(clips.join(" "), id);
      }
      for (let i = 0; i < clips.length; i++) {
        let buffer: AudioBuffer;
        try {
          buffer = await pending[i];
        } catch (e) {
          if (id !== runId.current) return false;
          setNotice(`Voice playback failed (${e instanceof Error ? e.message : "unknown"}); using the browser voice.`);
          return speakWithBrowser(clips.slice(i).join(" "), id);
        }
        if (id !== runId.current) return false;
        if (i === 0) {
          setPreparing(false);
          setSpeaking(true);
          setNotice(null);
          const firstAudio = performance.now() - t0;
          const tr = turn.current;
          console.info(
            tr?.sttMs !== undefined
              ? `[taskora] turn · stt ${Math.round(tr.sttMs)} ms · reply → first audio ${Math.round(firstAudio)} ms · total ${Math.round(performance.now() - tr.stoppedAt)} ms`
              : `[taskora] reply → first audio ${Math.round(firstAudio)} ms`,
          );
          turn.current = null;
        }
        if (!(await play(ctx, buffer, id))) return false;
      }
      if (id === runId.current) setSpeaking(false);
      return id === runId.current;
    },
    [audioCtx, clip, play, speakWithBrowser, stopPlayback],
  );

  /** A soft two-note chime: "your turn". */
  const chime = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, now + i * 0.09);
      g.gain.linearRampToValueAtTime(0.06, now + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.09);
      o.stop(now + i * 0.09 + 0.3);
    });
  }, []);

  useEffect(
    () => () => {
      runId.current++;
      sttId.current++;
      window.clearInterval(timer.current);
      window.clearTimeout(micTimer.current);
      recRef.current?.cancel();
      micRef.current?.close();
      playRef.current?.stop();
      window.speechSynthesis?.cancel();
      void ctxRef.current?.close();
    },
    [],
  );

  /** Call from a click/tap so the browser lets audio play later (autoplay policy). */
  const unlockAudio = useCallback(() => void audioCtx(), [audioCtx]);

  const mode: SpeechMode = listening ? "listening" : processing || preparing ? "thinking" : speaking ? "speaking" : "idle";

  return {
    supported,
    listening,
    processing,
    speaking,
    mode,
    transcript,
    seconds,
    error,
    notice,
    levelRef,
    start,
    stop,
    cancel,
    speak,
    prefetch,
    chime,
    stopPlayback,
    unlockAudio,
    releaseMic,
  };
}
