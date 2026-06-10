import { Component, Output, EventEmitter, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Upload, FileText, Image, Paperclip, X } from 'lucide-angular';
import { AttachmentService } from '../../services/attachment.service';

@Component({
  selector: 'app-attachment-upload',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './attachment-upload.component.html',
  styleUrls: ['./attachment-upload.component.css']
})
export class AttachmentUploadComponent {
  @Output() filesDropped = new EventEmitter<FileList>();
  @Output() filesPasted = new EventEmitter<DataTransfer>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isDragOver = false;
  isPasting = false;

  constructor(private attachmentService: AttachmentService) {}

  // Drag and drop handlers
  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.filesDropped.emit(files);
    }
  }

  // Paste handler
  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    const hasFiles = Array.from(items).some(item => item.kind === 'file');
    if (hasFiles) {
      event.preventDefault();
      this.isPasting = true;
      
      setTimeout(() => {
        this.isPasting = false;
        if (event.clipboardData) {
      this.filesPasted.emit(event.clipboardData);
    }
      }, 100);
    }
  }

  // Click to upload
  onClick(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this.filesDropped.emit(files);
      // Clear the input to allow selecting the same file again
      input.value = '';
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      // Ctrl+V paste is handled by the @HostListener paste event
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      this.onClick();
    }
  }

  getUploadIcon(): string {
    if (this.isDragOver) return 'upload';
    if (this.isPasting) return 'file-text';
    return 'upload';
  }

  getUploadText(): string {
    if (this.isDragOver) return 'Drop files here';
    if (this.isPasting) return 'Pasting...';
    return 'Click to upload or drag & drop';
  }

  getSupportedFormats(): string[] {
    return [
      'Images (PNG, JPG, GIF, WebP)',
      'Documents (PDF, DOC, DOCX, TXT, MD)',
      'Archives (ZIP, RAR)'
    ];
  }
}
