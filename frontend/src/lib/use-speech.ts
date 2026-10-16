"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Speech I/O behind one hook so the provider can change. Today it uses the browser's Web Speech
 * API (free, no keys). The plan is Sarvam saaras:v3 (STT) + bulbul:v3 (TTS) via server routes —
 * swap the internals of start()/speak() and nothing in the UI changes.
 */

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech(onFinal?: (text: string) => void, maxSeconds = 20) {
  const recRef = useRef<Rec | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const finalRef = useRef("");
  const cbRef = useRef(onFinal);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    cbRef.current = onFinal;
  }, [onFinal]);
  useEffect(() => setSupported(!!getRecognition()), []);

  const stop = useCallback(() => {
    window.clearInterval(timer.current);
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    window.speechSynthesis?.cancel();
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = true;
    finalRef.current = "";
    setTranscript("");
    setSeconds(0);
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      finalRef.current = text;
      setTranscript(text);
    };
    const finish = () => {
      window.clearInterval(timer.current);
      setListening(false);
      const text = finalRef.current.trim();
      if (text) cbRef.current?.(text);
    };
    rec.onend = finish;
    rec.onerror = finish;
    recRef.current = rec;
    rec.start();
    setListening(true);
    const startedAt = Date.now();
    timer.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= maxSeconds) rec.stop();
    }, 250);
  }, [maxSeconds]);

  const speak = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 1.02;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
  }, []);

  useEffect(
    () => () => {
      window.clearInterval(timer.current);
      recRef.current?.stop();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  return { supported, listening, speaking, transcript, seconds, start, stop, speak };
}
