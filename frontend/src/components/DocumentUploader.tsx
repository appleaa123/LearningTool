import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AudioRecordingError } from "@/types/langgraph";

type DocumentUploaderProps = {
  userId?: string;
  notebookId?: number;
  onSuccess?: (ids: string[]) => void;
  onError?: (message: string) => void;
};

/**
 * Document uploader for PDF/DOCX/PPTX/TXT/MD that posts to /ingest/document.
 */
export function DocumentUploader({
  userId = "anon",
  notebookId,
  onSuccess,
  onError,
}: DocumentUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ids, setIds] = useState<string[] | null>(null);
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
      const res = await fetch(`${apiBase}/ingest/document`, {
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
      const msg = (e as AudioRecordingError)?.message || "Failed to upload document";
      setError(msg);
      onError?.(msg);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card className="p-4 bg-neutral-900 border-neutral-700">
      <div className="space-y-3">
        <input
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-neutral-200 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-neutral-700 file:text-neutral-100 hover:file:bg-neutral-600"
        />
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
            {isUploading ? "Uploading..." : "Upload Document"}
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


