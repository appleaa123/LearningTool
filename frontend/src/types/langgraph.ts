// TypeScript interfaces for LangGraph SDK and application types
export interface ProcessedEvent {
  title: string;
  data: string;
}

// LangGraph stream event types
export interface LangGraphEvent {
  generate_query?: {
    search_query?: string[];
  };
  web_research?: {
    sources_gathered?: Array<{
      url: string;
      title: string;
      content: string;
      label?: string;
    }>;
  };
  finalize?: {
    report?: string;
  };
  // Legacy backend events
  reflection?: unknown;
  finalize_answer?: unknown;
  // ODR events
  clarify_with_user?: unknown;
  write_research_brief?: unknown;
  research_supervisor?: unknown;
  researcher?: unknown;
  researcher_tools?: unknown;
  compress_research?: unknown;
  final_report_generation?: unknown;
}

// API Response types
export interface IngestResponse {
  status: string;
  message?: string;
  chunks?: number;
  inserted?: number;
  text?: string;
}

export interface AssistantResponse {
  answer: string;
  sources?: Array<{
    url: string;
    title: string;
    relevance?: number;
  }>;
}

// Component props types
export interface MessageComponentProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export interface FileUploadResult {
  success: boolean;
  message: string;
  chunks?: number;
}

export interface AudioRecordingError {
  message: string;
  code?: string;
}

export interface MediaUploaderProps {
  onUpload: (files: FileList) => Promise<FileUploadResult>;
  acceptedTypes?: string[];
  maxFileSize?: number;
}

export interface DocumentUploaderProps {
  onUpload: (file: File) => Promise<FileUploadResult>;
  supportedFormats?: string[];
}

export interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => Promise<void>;
  onError?: (error: AudioRecordingError) => void;
}

// Provider availability types
export interface ProviderAvailability {
  openai?: boolean;
  gemini?: boolean;
}