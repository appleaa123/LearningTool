import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AudioRecordingError } from "@/types/langgraph";

type ProviderFlags = { openai?: boolean; gemini?: boolean };

type MediaUploaderProps = {
  userId?: string;
  providers?: ProviderFlags; // Available backend providers for optional toggles
  notebookId?: number;
  onSuccess?: (ids: string[]) => void;
  onError?: (message: string) => void;
};

/**
 * Photo/image uploader that posts to /ingest/image and returns inserted IDs.
 * Accepts image/* and prefers the rear camera on mobile via capture="environment".
 */
export function MediaUploader({ userId = "anon", providers, notebookId, onSuccess, onError }: MediaUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ids, setIds] = useState<string[] | null>(null);
  const [visionProvider, setVisionProvider] = useState<string>("gemini"); // ocr | gemini

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const apiBase = import.meta.env.DEV ? "/api" : "";

  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setIds(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("user_id", userId);
      if (notebookId != null) form.append("notebook_id", String(notebookId));
      // Include selected vision processor so server can route (ocr | gemini)
      form.append("vision_provider", visionProvider);
      const res = await fetch(`${apiBase}/ingest/image`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed with status ${res.status}`);
      }
      const data: { inserted: number; ids: string[] } = await res.json();
      setIds(data.ids);
      onSuccess?.(data.ids);
    } catch (e: unknown) {
      const msg = (e as AudioRecordingError)?.message || "Failed to upload image";
      setError(msg);
      onError?.(msg);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card className="p-4 bg-neutral-900 border-neutral-700">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-300">Process with</label>
          <select
            value={visionProvider}
            onChange={(e) => setVisionProvider(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
          >
            <option value="ocr">OCR (Tesseract)</option>
            <option value="gemini" disabled={!providers?.gemini}>Gemini Vision</option>
          </select>
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-neutral-200 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-neutral-700 file:text-neutral-100 hover:file:bg-neutral-600"
        />
        {previewUrl && (
          <img src={previewUrl} alt="preview" className="max-h-56 rounded border border-neutral-700" />
        )}
        {error && (
          <div className="text-red-400 text-sm bg-red-950/40 border border-red-700 rounded p-2">{error}</div>
        )}
        {ids && (
          <div className="text-green-400 text-sm bg-green-950/40 border border-green-700 rounded p-2">
            Uploaded. IDs: {ids.join(", ")}
          </div>
        )}
        <div className="flex gap-2">
          <Button disabled={!file || isUploading} onClick={handleUpload}>
            {isUploading ? "Uploading..." : "Upload Photo"}
          </Button>
          {error && (
            <Button variant="destructive" onClick={handleUpload} disabled={isUploading}>
              Retry
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}


