export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'text';
  mimeType: string;
  size: number;
  url?: string;
  content?: string; // Base64 for small files/images
  uploadedAt: Date;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  metadata?: {
    width?: number;
    height?: number;
    pages?: number;
    extractedText?: string;
    fileExtension?: string;
  };
}

export interface AttachmentUploadRequest {
  file: File;
  workspaceId?: string;
  sessionId?: string;
}

export interface AttachmentPreview {
  id: string;
  name: string;
  type: 'image' | 'document' | 'text';
  thumbnail?: string;
  size: string;
  status: 'uploading' | 'completed' | 'error';
  progress?: number;
  removeable: boolean;
}

export interface AttachmentContext {
  attachments: Attachment[];
  totalSize: number;
  hasImages: boolean;
  hasDocuments: boolean;
  extractedTexts: string[];
}
