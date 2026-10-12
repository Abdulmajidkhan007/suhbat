import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VOICE_DURATION_MS } from '@suhbat/core';
import { pickRecorderMime, recorderErrorMessage } from '../utils/recorder';

export interface RecordedVoice {
  blob:       Blob;
  durationMs: number;
}

interface Options {
  onRecorded: (voice: RecordedVoice) => void;
  onError:    (message: string) => void;
}

/** MediaRecorder: `start` → yozadi; `stop` → `onRecorded`; `cancel` → tashlab yuboradi. Maks. 5 daqiqa. */
export const useVoiceRecorder = ({ onRecorded, onError }: Options) => {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cancelledRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const callbacks = useRef({ onRecorded, onError });
  callbacks.current = { onRecorded, onError };

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;

  const finish = useCallback(() => {
    clearInterval(tickRef.current);
    setRecording(false);
    setElapsedMs(0);
  }, []);

  const start = useCallback(async () => {
    if (!supported || recorderRef.current) return;
    const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return callbacks.current.onError('Brauzer ovoz yozishni qo\'llab-quvvatlamaydi.');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      return callbacks.current.onError(recorderErrorMessage(e));
    }
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    cancelledRef.current = false;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      finish();
      if (cancelledRef.current || chunks.length === 0) return;
      callbacks.current.onRecorded({
        blob:       new Blob(chunks, { type: mime }),
        durationMs: Math.min(Date.now() - startedAt, MAX_VOICE_DURATION_MS),
      });
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsedMs(ms);
      if (ms >= MAX_VOICE_DURATION_MS) recorder.stop();
    }, 250);
  }, [supported, finish]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
  }, []);

  // Komponent yopilganda mikrofon o'chadi.
  useEffect(() => () => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
    clearInterval(tickRef.current);
  }, []);

  return { supported, recording, elapsedMs, start, stop, cancel };
};
