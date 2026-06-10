import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Uploaded File Interface
 */
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  extractedText?: string;
  uploadedAt: Date;
  preview?: string;
}

/**
 * File Upload Response
 */
export interface FileUploadResponse {
  success: boolean;
  file?: UploadedFile;
  error?: string;
}

/**
 * Supported file types for different contexts
 */
export const SUPPORTED_FILE_TYPES = {
  architecture: ['.png', '.jpg', '.jpeg', '.svg', '.xml', '.json', '.drawio', '.mmd'],
  documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'],
  technical: ['.yaml', '.yml', '.json', '.xml', '.tf', '.hcl', '.puml', '.plantuml'],
  all: ['.png', '.jpg', '.jpeg', '.svg', '.xml', '.json', '.drawio', '.mmd', 
        '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf',
        '.yaml', '.yml', '.tf', '.hcl', '.puml', '.plantuml']
};

/**
 * File Upload Service
 * 
 * Handles file uploads and text extraction for:
 * - Architecture diagrams (images, XML, JSON)
 * - Requirements documents (PDF, DOC, TXT)
 * - Technical artifacts (YAML, JSON, Terraform)
 */
@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private readonly backendUrl = environment.api.backendUrl;
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(private http: HttpClient) {}

  /**
   * Upload a file and extract its content
   */
  uploadFile(file: File): Observable<FileUploadResponse> {
    // Validate file size
    if (file.size > this.maxFileSize) {
      return of({
        success: false,
        error: `File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`
      });
    }

    // For text-based files, read content directly
    if (this.isTextFile(file)) {
      return this.readTextFile(file);
    }

    // For images, convert to base64 and optionally send to backend for OCR
    if (this.isImageFile(file)) {
      return this.readImageFile(file);
    }

    // For other files, upload to backend
    return this.uploadToBackend(file);
  }

  /**
   * Upload multiple files
   */
  uploadFiles(files: File[]): Observable<FileUploadResponse[]> {
    const uploads = files.map(file => this.uploadFile(file));
    return new Observable(observer => {
      const results: FileUploadResponse[] = [];
      let completed = 0;
      
      uploads.forEach((upload, index) => {
        upload.subscribe({
          next: (result) => {
            results[index] = result;
            completed++;
            if (completed === files.length) {
              observer.next(results);
              observer.complete();
            }
          },
          error: (err) => {
            results[index] = { success: false, error: err.message };
            completed++;
            if (completed === files.length) {
              observer.next(results);
              observer.complete();
            }
          }
        });
      });
    });
  }

  /**
   * Validate file type
   */
  isValidFileType(file: File, context: 'architecture' | 'documents' | 'technical' | 'all' = 'all'): boolean {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    return SUPPORTED_FILE_TYPES[context].includes(extension);
  }

  /**
   * Get file extension
   */
  getFileExtension(filename: string): string {
    return '.' + (filename.split('.').pop()?.toLowerCase() || '');
  }

  /**
   * Check if file is text-based
   */
  private isTextFile(file: File): boolean {
    const textExtensions = ['.txt', '.md', '.json', '.xml', '.yaml', '.yml', '.tf', '.hcl', '.puml', '.plantuml', '.mmd', '.drawio'];
    const extension = this.getFileExtension(file.name);
    return textExtensions.includes(extension) || file.type.startsWith('text/');
  }

  /**
   * Check if file is an image
   */
  private isImageFile(file: File): boolean {
    return file.type.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.svg'].includes(this.getFileExtension(file.name));
  }

  /**
   * Read text file content
   */
  private readTextFile(file: File): Observable<FileUploadResponse> {
    return new Observable(observer => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        observer.next({
          success: true,
          file: {
            id: this.generateId(),
            name: file.name,
            size: file.size,
            type: file.type || this.getMimeType(file.name),
            content: content,
            extractedText: content,
            uploadedAt: new Date(),
            preview: this.generateTextPreview(content)
          }
        });
        observer.complete();
      };

      reader.onerror = () => {
        observer.next({
          success: false,
          error: 'Failed to read file'
        });
        observer.complete();
      };

      reader.readAsText(file);
    });
  }

  /**
   * Read image file as base64
   */
private readImageFile(file: File): Observable<FileUploadResponse> {
  return new Observable(observer => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const base64 = e.target?.result as string;

      observer.next({
        success: true,
        file: {
          id: this.generateId(),
          name: file.name,
          size: file.size,
          type: file.type,
          content: base64,
          extractedText: `[Image: ${file.name}]`,
          uploadedAt: new Date(),
          preview: base64 // 👈 ADD THIS
        }
      });
      observer.complete();
    };

    reader.onerror = () => {
      observer.next({
        success: false,
        error: 'Failed to read image'
      });
      observer.complete();
    };

    reader.readAsDataURL(file);
  });
}

  /**
   * Upload file to backend for processing
   */
  private uploadToBackend(file: File): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<any>(`${this.backendUrl}/api/v1/files/upload`, formData).pipe(
      map(response => ({
        success: true,
        file: {
          id: response.id || this.generateId(),
          name: file.name,
          size: file.size,
          type: file.type,
          content: response.content,
          extractedText: response.extractedText || response.content,
          uploadedAt: new Date(),
          preview: this.generatePreview(file)
        }
      })),
      catchError(error => {
        console.error('Upload error:', error);
        // Fallback to local reading for PDF/DOC
        return this.readAsBinaryFallback(file);
      })
    );
  }

  /**
   * Fallback for binary files - read and note for backend processing
   */
private readAsBinaryFallback(file: File): Observable<FileUploadResponse> {
  return new Observable(observer => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const base64 = e.target?.result as string;

      observer.next({
        success: true,
        file: {
          id: this.generateId(),
          name: file.name,
          size: file.size,
          type: file.type,
          content: base64,
          extractedText: `[Document: ${file.name} - Content will be processed by AI]`,
          uploadedAt: new Date(),
          preview: this.generatePreview(file, base64) // 👈 ADD
        }
      });
      observer.complete();
    };

    reader.onerror = () => {
      observer.next({
        success: false,
        error: 'Failed to read file'
      });
      observer.complete();
    };

    reader.readAsDataURL(file);
  });
}

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return 'file-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = this.getFileExtension(filename);
    const mimeTypes: { [key: string]: string } = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.yaml': 'application/x-yaml',
      '.yml': 'application/x-yaml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.drawio': 'application/xml',
      '.mmd': 'text/plain',
      '.tf': 'text/plain',
      '.hcl': 'text/plain',
      '.puml': 'text/plain',
      '.plantuml': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Build context string from uploaded files
   */
  buildContextFromFiles(files: UploadedFile[]): string {
    if (!files.length) return '';
    
    const contextParts = files.map(file => {
      const fileType = this.categorizeFile(file.name);
      return `--- ${fileType}: ${file.name} ---\n${file.extractedText || file.content || '[No content extracted]'}`;
    });
    
    return contextParts.join('\n\n');
  }

  /**
   * Categorize file type for context building
   */
  private categorizeFile(filename: string): string {
    const ext = this.getFileExtension(filename);
    
    if (['.png', '.jpg', '.jpeg', '.svg', '.drawio'].includes(ext)) {
      return 'Architecture Diagram';
    }
    if (['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'].includes(ext)) {
      return 'Document';
    }
    if (['.yaml', '.yml', '.json', '.xml'].includes(ext)) {
      return 'Configuration';
    }
    if (['.tf', '.hcl'].includes(ext)) {
      return 'Infrastructure Code';
    }
    if (['.puml', '.plantuml', '.mmd'].includes(ext)) {
      return 'Diagram Code';
    }
    return 'Attachment';
  }
  private generatePreview(file: File, base64?: string): string | undefined {
  if (file.type.startsWith('image/')) {
    return base64; 
  }
  return undefined;
}
private generateTextPreview(content: string): string {
  return content.slice(0, 100); 
}

/**
 * Get icon name based on file type
 */
getFileIcon(fileName: string): string {
  if (!fileName) return 'File';

  const ext = this.getFileExtension(fileName)?.toLowerCase();

  if (!ext) return 'File';

  // Images
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
    return 'Image';
  }

  //  Documents
  if (['.pdf'].includes(ext)) return 'FileText';
  if (['.doc', '.docx'].includes(ext)) return 'FileText';
  if (['.txt', '.md', '.rtf'].includes(ext)) return 'FileText';

  // Code / config
  if (['.json', '.xml', '.yaml', '.yml', '.tf', '.hcl'].includes(ext)) {
    return 'Code';
  }

  // Diagrams
  if (['.puml', '.plantuml', '.mmd', '.drawio'].includes(ext)) {
    return 'Workflow'; // or 'GitBranch'
  }

  // Archives
  if (['.zip', '.rar', '.7z'].includes(ext)) return 'Archive';

  return 'File'; // fallback
}
}
