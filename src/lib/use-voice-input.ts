"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Minimal React hook around the browser SpeechRecognition API.
 * Chrome, Edge, and Safari ship it (vendor-prefixed in WebKit). Firefox
 * does not yet — `supported` returns false there and the consumer should
 * hide the mic button.
 *
 * One-shot per click: starts on .start(), auto-stops on first final
 * result. No streaming / interim results — the AddExpense form just
 * needs one utterance.
 */

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
  message?: string;
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceInputSupported(): boolean {
  return getCtor() !== null;
}

export function useVoiceInput(opts: {
  /** BCP-47 language tag. Default 'en-IN' so Indian English numerals + brand names land. */
  lang?: string;
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => isVoiceInputSupported());
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Cleanup any in-flight recognition on unmount.
  useEffect(
    () => () => {
      recRef.current?.abort();
      recRef.current = null;
    },
    [],
  );

  const start = () => {
    const Ctor = getCtor();
    if (!Ctor) return;
    // Tear down any prior session so consecutive clicks restart cleanly.
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = opts.lang ?? "en-IN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const r = e.results?.[0];
      const transcript = r?.[0]?.transcript ?? "";
      if (transcript) opts.onResult(transcript);
    };
    rec.onerror = (e) => {
      opts.onError?.(e.error || "speech-error");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      // Older Safari throws if .start() is called twice quickly.
      opts.onError?.(err instanceof Error ? err.message : "start-failed");
      setListening(false);
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { start, stop, listening, supported };
}
