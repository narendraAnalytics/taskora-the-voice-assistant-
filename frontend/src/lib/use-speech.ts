"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { startRecorder, type Recorder } from "@/lib/voice/recorder";
import { synthesize, transcribe } from "@/lib/voice/api";

/*
 * Speech I/O behind one hook so the provider can change. Hearing and speaking go through the
 * Taskora FastAPI backend (Sarvam saaras:v4 / bulbul:v4-flash); if speaking fails it falls back
 * to the browser voice. `levelRef` (0..1) carries live loudness — mic while listening, reply audio
 * while speaking — so the avatar can move without re-rendering React.
 */

export type SpeechMode = "idle" | "listening" | "thinking" | "speaking";

export function useSpeech(onFinal?: (text: string) => void, maxSeconds = 20, keyterms: string[] = []) {
  const { getToken } = useAuth();
  const recRef = useRef<Recorder | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const cbRef = useRef(onFinal);
  const termsRef = useRef(keyterms);
  const levelRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const playRef = useRef<{ stop: () => void } | null>(null);
  const runId = useRef(0); // lets a newer speak() cancel an older one mid-flight
  const sttId = useRef(0); // same for transcription (kept apart so speaking a reply does not cancel it)
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // playback trouble, shown without hiding the reply

  useEffect(() => {
    cbRef.current = onFinal;
    termsRef.current = keyterms;
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

  const stopPlayback = useCallback(() => {
    playRef.current?.stop();
    playRef.current = null;
    window.speechSynthesis?.cancel();
    levelRef.current = 0;
    setSpeaking(false);
  }, []);

  const stop = useCallback(async () => {
    window.clearInterval(timer.current);
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    setListening(false);
    const id = ++sttId.current;
    setProcessing(true);
    try {
      const wav = await rec.finish();
      const out = await transcribe(wav, await getToken(), termsRef.current);
      if (id !== sttId.current) return;
      const text = out.text.trim();
      setTranscript(text);
      if (text) cbRef.current?.(text);
    } catch (e) {
      const why = e instanceof Error ? e.message : "network error";
      if (id === sttId.current) setError(`I couldn't hear that (${why}). Try again.`);
    } finally {
      if (id === sttId.current) setProcessing(false);
    }
  }, [getToken]);

  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    stopPlayback();
    sttId.current++; // a new take cancels any transcription still in flight
    setProcessing(false);
    audioCtx(); // unlock playback while we still have the tap that started this
    setError(null);
    setTranscript("");
    setSeconds(0);
    try {
      recRef.current = await startRecorder({
        onLevel: (l) => (levelRef.current = l),
        onSilence: () => void stopRef.current(),
      });
    } catch {
      setError("Microphone is blocked. Allow it in the browser and try again.");
      return;
    }
    setListening(true);
    const startedAt = Date.now();
    timer.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= maxSeconds) void stopRef.current();
    }, 250);
  }, [audioCtx, maxSeconds, stopPlayback]);

  const speakWithBrowser = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    let raf = 0;
    const wiggle = () => {
      levelRef.current = 0.25 + 0.35 * Math.abs(Math.sin(performance.now() / 110)); // no real signal; fake mouth
      raf = requestAnimationFrame(wiggle);
    };
    u.onstart = () => {
      setSpeaking(true);
      wiggle();
    };
    const end = () => {
      cancelAnimationFrame(raf);
      levelRef.current = 0;
      setSpeaking(false);
    };
    u.onend = end;
    u.onerror = end;
    synth.cancel();
    synth.speak(u);
  }, []);

  const speak = useCallback(
    async (text: string, languageCode = "en-IN") => {
      stopPlayback();
      const id = ++runId.current;
      try {
        const bytes = await synthesize(text, await getToken(), languageCode);
        if (id !== runId.current) return;
        const ctx = audioCtx();
        await ctx.resume();
        if (ctx.state !== "running") throw new Error("audio is locked by the browser");
        const buffer = await ctx.decodeAudioData(bytes);
        if (id !== runId.current) return;
        const src = ctx.createBufferSource();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.buffer = buffer;
        src.connect(analyser).connect(ctx.destination);
        const data = new Uint8Array(analyser.fftSize);
        let raf = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const b of data) sum += ((b - 128) / 128) ** 2;
          levelRef.current = levelRef.current * 0.5 + Math.min(Math.sqrt(sum / data.length) * 5, 1) * 0.5;
          raf = requestAnimationFrame(tick);
        };
        src.onended = () => {
          cancelAnimationFrame(raf);
          levelRef.current = 0;
          setSpeaking(false);
        };
        playRef.current = {
          stop: () => {
            src.onended = null;
            cancelAnimationFrame(raf);
            try {
              src.stop();
            } catch {}
          },
        };
        setSpeaking(true);
        src.start();
        tick();
        setNotice(null);
      } catch (e) {
        if (id !== runId.current) return;
        setNotice(`Voice playback failed (${e instanceof Error ? e.message : "unknown"}); using the browser voice.`);
        speakWithBrowser(text);
      }
    },
    [audioCtx, getToken, speakWithBrowser, stopPlayback],
  );

  useEffect(
    () => () => {
      runId.current++;
      sttId.current++;
      window.clearInterval(timer.current);
      recRef.current?.cancel();
      playRef.current?.stop();
      window.speechSynthesis?.cancel();
      void ctxRef.current?.close();
    },
    [],
  );

  /** Call from a click/tap so the browser lets audio play later (autoplay policy). */
  const unlockAudio = useCallback(() => void audioCtx(), [audioCtx]);

  const mode: SpeechMode = listening ? "listening" : processing ? "thinking" : speaking ? "speaking" : "idle";

  return { supported, listening, processing, speaking, mode, transcript, seconds, error, notice, levelRef, start, stop, speak, stopPlayback, unlockAudio };
}
