import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { Attachment, AttachmentUploadRequest, AttachmentPreview, AttachmentContext } from '../models/attachment.model';

@Injectable({
  providedIn: 'root'
})
export class AttachmentService {
  private attachments = new BehaviorSubject<Attachment[]>([]);
  private uploadProgress = new Subject<{ id: string; progress: number }>();
  
  constructor() {}

  // Get current attachments
  getAttachments(): Observable<Attachment[]> {
    return this.attachments.asObservable();
  }

  // Get upload progress
  getUploadProgress(): Observable<{ id: string; progress: number }> {
    return this.uploadProgress.asObservable();
  }

  // Max file size: 5MB
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  private readonly SUPPORTED_TYPES = [
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
    'text/plain', 'text/markdown', 'text/csv', 'text/xml', 'text/html',
    'application/json', 'application/xml', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  // Read file client-side and add to attachment list (no backend upload needed)
  uploadFile(request: AttachmentUploadRequest): Observable<Attachment> {
    const file = request.file;

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      const error = `File "${file.name}" exceeds 5MB limit (${this.formatFileSize(file.size)})`;
      console.error('[AttachmentService]', error);
      return throwError(() => new Error(error));
    }

    // Validate file type
    if (this.SUPPORTED_TYPES.length > 0 && !this.SUPPORTED_TYPES.includes(file.type) && file.type !== '') {
      const error = `Unsupported file type: ${file.type || file.name.split('.').pop()}`;
      console.error('[AttachmentService]', error);
      return throwError(() => new Error(error));
    }

    const attachment: Attachment = {
      id: this.generateId(),
      name: file.name,
      type: this.getAttachmentType(file),
      mimeType: file.type,
      size: file.size,
      status: 'processing',
      uploadedAt: new Date(),
      metadata: { fileExtension: file.name.split('.').pop() || '' },
    };

    this.addAttachment(attachment);
    this.uploadProgress.next({ id: attachment.id, progress: 30 });

    return new Observable<Attachment>(observer => {
      const reader = new FileReader();

      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          this.uploadProgress.next({ id: attachment.id, progress: Math.round(30 + 60 * e.loaded / e.total) });
        }
      };

      reader.onload = () => {
        const result = reader.result as string;
        if (attachment.type === 'image') {
          // Store as base64 data URL
          attachment.content = result;
        } else {
          // For text/document types read as text, extract content
          attachment.content = result;
          attachment.metadata = { ...attachment.metadata, extractedText: result };
        }
        attachment.status = 'completed';
        this.updateAttachment(attachment.id, attachment);
        this.uploadProgress.next({ id: attachment.id, progress: 100 });

        console.log(`[AttachmentService] File read: ${file.name} (${this.formatFileSize(file.size)})`);
        observer.next(attachment);
        observer.complete();
      };

      reader.onerror = () => {
        const error = `Failed to read file: ${file.name}`;
        attachment.status = 'error';
        attachment.error = error;
        this.updateAttachment(attachment.id, attachment);
        observer.error(new Error(error));
      };

      // Read images as base64, everything else as text
      if (attachment.type === 'image') {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  }

  // Handle paste event
  handlePaste(event: ClipboardEvent, workspaceId?: string, sessionId?: string): Observable<Attachment[]> {
    const items = event.clipboardData?.items;
    if (!items) return of([]);

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length === 0) return of([]);

    // Upload all pasted files and return array
    const uploadObservables = files.map(file => this.uploadFile({ file, workspaceId, sessionId }));
    return new Observable<Attachment[]>(observer => {
      let completed = 0;
      const results: Attachment[] = [];
      
      uploadObservables.forEach((obs, index) => {
        obs.subscribe({
          next: (attachment) => {
            if (attachment) {
              results[index] = attachment;
            }
          },
          error: (error) => {
            observer.error(error);
          },
          complete: () => {
            completed++;
            if (completed === files.length) {
              observer.next(results.filter(Boolean));
              observer.complete();
            }
          }
        });
      });
    });
  }

  // Handle drag and drop
  handleDrop(files: FileList, workspaceId?: string, sessionId?: string): Observable<Attachment[]> {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return of([]);

    const uploadObservables = fileArray.map(file => this.uploadFile({ file, workspaceId, sessionId }));
    return new Observable<Attachment[]>(observer => {
      let completed = 0;
      const results: Attachment[] = [];
      
      uploadObservables.forEach((obs, index) => {
        obs.subscribe({
          next: (attachment) => {
            if (attachment) {
              results[index] = attachment;
            }
          },
          error: (error) => {
            observer.error(error);
          },
          complete: () => {
            completed++;
            if (completed === fileArray.length) {
              observer.next(results.filter(Boolean));
              observer.complete();
            }
          }
        });
      });
    });
  }

  // Remove attachment
  removeAttachment(id: string): void {
    const current = this.attachments.value;
    this.attachments.next(current.filter(a => a.id !== id));
  }

  // Clear all attachments
  clearAttachments(): void {
    this.attachments.next([]);
  }

  // Get attachment context for agents
  getAttachmentContext(): AttachmentContext {
    const attachments = this.attachments.value;
    return {
      attachments,
      totalSize: attachments.reduce((sum, a) => sum + a.size, 0),
      hasImages: attachments.some(a => a.type === 'image'),
      hasDocuments: attachments.some(a => a.type === 'document'),
      extractedTexts: attachments
                .filter(a => a.metadata?.extractedText)
                .map(a => a.metadata?.extractedText || '')
    };
  }

  // Convert attachments to agent context
  toAgentContext(): any {
    const context = this.getAttachmentContext();
    return {
      hasAttachments: context.attachments.length > 0,
      attachments: context.attachments.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        mimeType: a.mimeType,
        size: a.size,
        url: a.url,
        extractedText: a.metadata?.extractedText || '',
        metadata: a.metadata || {}
      })),
      totalSize: context.totalSize,
      summary: this.generateAttachmentSummary(context)
    };
  }

  private addAttachment(attachment: Attachment): void {
    const current = this.attachments.value;
    this.attachments.next([...current, attachment]);
  }

  private updateAttachment(id: string, updates: Partial<Attachment>): void {
    const current = this.attachments.value;
    this.attachments.next(current.map(a => a.id === id ? { ...a, ...updates } : a));
  }

  private updateAttachmentStatus(id: string, status: Attachment['status'], error?: string): void {
    this.updateAttachment(id, { status, error });
  }

  private getAttachmentType(file: File): 'image' | 'document' | 'text' {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) return 'text';
    return 'document';
  }

  private generateId(): string {
    return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAttachmentSummary(context: AttachmentContext): string {
    const parts = [];
    if (context.attachments.length > 0) {
      parts.push(`${context.attachments.length} file(s) attached`);
    }
    if (context.hasImages) {
      parts.push('includes images');
    }
    if (context.hasDocuments) {
      parts.push('includes documents');
    }
    if (context.totalSize > 0) {
      parts.push(`total size: ${this.formatFileSize(context.totalSize)}`);
    }
    return parts.join(', ');
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
