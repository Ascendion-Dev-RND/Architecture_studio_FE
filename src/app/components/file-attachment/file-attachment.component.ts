import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { FileUploadService, UploadedFile, SUPPORTED_FILE_TYPES } from '../../services/file-upload.service';

/**
 * File Attachment Component
 * 
 * Reusable component for file uploads across:
 * - Architecture Generator
 * - Assessment
 * - E2E System Design
 */
@Component({
  selector: 'app-file-attachment',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="file-attachment-container">
      <!-- Upload Button -->
      <button 
        type="button"
        class="attach-btn"
        (click)="triggerFileInput()"
        [title]="'Attach files (' + acceptedTypes + ')'"
      >
        <lucide-icon name="Paperclip" [size]="18"></lucide-icon>
        <span *ngIf="showLabel">Attach</span>
      </button>

      <!-- Hidden File Input -->
      <input
        #fileInput
        type="file"
        [accept]="acceptedTypes"
        [multiple]="multiple"
        (change)="onFileSelected($event)"
        style="display: none"
      />

      <!-- Uploaded Files List -->
      <div class="uploaded-files" *ngIf="uploadedFiles.length > 0">
        <div class="file-chip" *ngFor="let file of uploadedFiles; let i = index">
          <lucide-icon [name]="getFileIcon(file.name)" [size]="14"></lucide-icon>
          <span class="file-name" [title]="file.name">{{ truncateFileName(file.name) }}</span>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
          <button class="remove-btn" (click)="removeFile(i)" title="Remove">
            <lucide-icon name="X" [size]="12"></lucide-icon>
          </button>
        </div>
      </div>

      <!-- Drop Zone (optional expanded view) -->
      <div 
        *ngIf="showDropZone"
        class="drop-zone"
        [class.drag-over]="isDragOver"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        <lucide-icon name="Upload" [size]="24"></lucide-icon>
        <p>Drop files here or <span class="browse-link" (click)="triggerFileInput()">browse</span></p>
        <p class="hint">{{ hint }}</p>
      </div>

      <!-- Error Message -->
      <div class="error-message" *ngIf="errorMessage">
        <lucide-icon name="AlertCircle" [size]="14"></lucide-icon>
        {{ errorMessage }}
      </div>
    </div>
  `,
  styles: [`
    .file-attachment-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .attach-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
    }

    .attach-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
      color: white;
    }

    .uploaded-files {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .file-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: rgba(139, 92, 246, 0.2);
      border: 1px solid rgba(139, 92, 246, 0.3);
      border-radius: 20px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.9);
    }

    .file-name {
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      color: rgba(255, 255, 255, 0.5);
      font-size: 11px;
    }

    .remove-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      padding: 0;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 50%;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .remove-btn:hover {
      background: rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }

    .drop-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      border: 2px dashed rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
      transition: all 0.2s ease;
      text-align: center;
    }

    .drop-zone.drag-over {
      border-color: rgba(139, 92, 246, 0.5);
      background: rgba(139, 92, 246, 0.1);
    }

    .drop-zone p {
      margin: 8px 0 0;
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
    }

    .drop-zone .hint {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
    }

    .browse-link {
      color: #8b5cf6;
      cursor: pointer;
      text-decoration: underline;
    }

    .browse-link:hover {
      color: #a78bfa;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      color: #ef4444;
      font-size: 12px;
    }
  `]
})
export class FileAttachmentComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  @Input() multiple: boolean = true;
  @Input() showLabel: boolean = false;
  @Input() showDropZone: boolean = false;
  @Input() context: 'architecture' | 'documents' | 'technical' | 'all' = 'all';
  @Input() hint: string = 'Supports diagrams, documents, and technical files';
  @Input() maxFiles: number = 5;

  @Output() filesChanged = new EventEmitter<UploadedFile[]>();
  @Output() contextBuilt = new EventEmitter<string>();

  uploadedFiles: UploadedFile[] = [];
  isDragOver: boolean = false;
  errorMessage: string = '';

  constructor(private fileUploadService: FileUploadService) {}

  get acceptedTypes(): string {
    return SUPPORTED_FILE_TYPES[this.context].join(',');
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
    }
    input.value = ''; // Reset for re-upload of same file
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer?.files) {
      this.processFiles(Array.from(event.dataTransfer.files));
    }
  }

  private processFiles(files: File[]): void {
    this.errorMessage = '';

    // Check max files
    if (this.uploadedFiles.length + files.length > this.maxFiles) {
      this.errorMessage = `Maximum ${this.maxFiles} files allowed`;
      return;
    }

    // Validate file types
    const invalidFiles = files.filter(f => !this.fileUploadService.isValidFileType(f, this.context));
    if (invalidFiles.length > 0) {
      this.errorMessage = `Invalid file type: ${invalidFiles.map(f => f.name).join(', ')}`;
      return;
    }

    // Upload files
    this.fileUploadService.uploadFiles(files).subscribe({
      next: (results) => {
        results.forEach(result => {
          if (result.success && result.file) {
            this.uploadedFiles.push(result.file);
          } else if (result.error) {
            this.errorMessage = result.error;
          }
        });
        this.emitChanges();
      },
      error: (err) => {
        this.errorMessage = 'Failed to upload files';
        console.error('Upload error:', err);
      }
    });
  }

  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
    this.emitChanges();
  }

  private emitChanges(): void {
    this.filesChanged.emit([...this.uploadedFiles]);
    const context = this.fileUploadService.buildContextFromFiles(this.uploadedFiles);
    this.contextBuilt.emit(context);
  }

  getFileIcon(filename: string): string {
    const ext = this.fileUploadService.getFileExtension(filename);
    
    if (['.png', '.jpg', '.jpeg', '.svg'].includes(ext)) return 'Image';
    if (['.pdf'].includes(ext)) return 'FileText';
    if (['.doc', '.docx', '.txt', '.md', '.rtf'].includes(ext)) return 'FileText';
    if (['.json', '.xml', '.yaml', '.yml'].includes(ext)) return 'FileCode';
    if (['.tf', '.hcl'].includes(ext)) return 'Cloud';
    if (['.drawio', '.mmd', '.puml', '.plantuml'].includes(ext)) return 'GitBranch';
    return 'File';
  }

  truncateFileName(name: string): string {
    if (name.length <= 20) return name;
    const ext = name.split('.').pop() || '';
    const baseName = name.slice(0, name.length - ext.length - 1);
    return baseName.slice(0, 15) + '...' + ext;
  }

  formatFileSize(bytes: number): string {
    return this.fileUploadService.formatFileSize(bytes);
  }

  clearAll(): void {
    this.uploadedFiles = [];
    this.errorMessage = '';
    this.emitChanges();
  }

  openFilePicker(): void {
  this.triggerFileInput();
}
}
