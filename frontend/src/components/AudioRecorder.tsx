import { Card } from "@/components/ui/card";

type AudioRecorderProps = {
  userId?: string;
  providers?: any; // Kept for compatibility
  notebookId?: number;
  onSuccess?: (ids: string[]) => void;
  onError?: (message: string) => void;
};

/**
 * Audio recorder component - currently disabled until fully developed.
 * Shows development message indicating feature is under development.
 */
export function AudioRecorder({}: AudioRecorderProps) {
  // Audio functionality disabled, showing development message

  // REQ-001: Audio recording disabled with development message
  return (
    <Card className="p-4 bg-neutral-900 border-neutral-700 space-y-3">
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-3">
          <div className="text-4xl mb-2">🎙️</div>
          <h3 className="text-neutral-300 font-medium">Voice Recording</h3>
          <p className="text-neutral-400 text-sm max-w-xs">
            Sorry, this feature is under development and will be live soon!
          </p>
        </div>
      </div>
    </Card>
  );
}


