import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ProviderFlags = { openai?: boolean; gemini?: boolean };

type AudioRecorderProps = {
  userId?: string;
  providers?: ProviderFlags; // Backend availability for enabling options
  notebookId?: number;
  onSuccess?: (ids: string[]) => void;
  onError?: (message: string) => void;
};

/**
 * Simple audio recorder using MediaRecorder that posts audio/webm to /ingest/audio.
 * Includes an ASR provider toggle to select Whisper (default) or Gemini (server-side not yet active).
 */
export function AudioRecorder({ userId = "anon", providers, notebookId, onSuccess, onError }: AudioRecorderProps) {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ids, setIds] = useState<string[] | null>(null);
  const [provider, setProvider] = useState<string>("whisper");
  const audioRef = useRef<HTMLAudioElement>(null);
  const apiBase = import.meta.env.DEV ? "/api" : "";

  useEffect(() => {
    return () => {
      mediaRecorder?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [mediaRecorder]);

  async function startRecording() {
    setError(null);
    setIds(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const localChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) localChunks.push(e.data);
      };
      recorder.onstop = () => setChunks(localChunks);
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (e: any) {
      const msg = e?.message || "Microphone permission denied or unsupported";
      setError(msg);
      onError?.(msg);
    }
  }

  function stopRecording() {
    mediaRecorder?.stop();
    mediaRecorder?.stream.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
  }

  async function uploadAudio() {
    setError(null);
    setIds(null);
    try {
      if (chunks.length === 0) throw new Error("No audio recorded yet");
      const blob = new Blob(chunks, { type: "audio/webm" });
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.src = url;

      const form = new FormData();
      form.append("file", file);
      form.append("user_id", userId);
      form.append("asr_provider", provider);
      if (notebookId != null) form.append("notebook_id", String(notebookId));
      const res = await fetch(`${apiBase}/ingest/audio`, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed with status ${res.status}`);
      }
      const data: { inserted: number; ids: string[] } = await res.json();
      setIds(data.ids);
      onSuccess?.(data.ids);
    } catch (e: any) {
      const msg = e?.message || "Failed to upload audio";
      setError(msg);
      onError?.(msg);
    }
  }

  return (
    <Card className="p-4 bg-neutral-900 border-neutral-700 space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-neutral-300">Transcribe with</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
        >
          <option value="whisper">Whisper (CLI)</option>
          <option value="openai" disabled={!providers?.openai}>OpenAI ASR</option>
          <option value="gemini" disabled={!providers?.gemini}>Gemini ASR</option>
        </select>
      </div>
      <div className="flex gap-2">
        {!isRecording ? (
          <Button onClick={startRecording}>Start Recording</Button>
        ) : (
          <Button variant="destructive" onClick={stopRecording}>Stop</Button>
        )}
        <Button onClick={uploadAudio} disabled={chunks.length === 0}>Upload</Button>
      </div>
      <audio ref={audioRef} controls className="w-full" />
      {error && (
        <div className="text-red-400 text-sm bg-red-950/40 border border-red-700 rounded p-2">{error}</div>
      )}
      {ids && (
        <div className="text-green-400 text-sm bg-green-950/40 border border-green-700 rounded p-2">
          Uploaded. IDs: {ids.join(", ")}
        </div>
      )}
    </Card>
  );
}


