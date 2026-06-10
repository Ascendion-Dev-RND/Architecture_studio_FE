import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, FileText, Image, Paperclip, Upload, Loader2, AlertCircle } from 'lucide-angular';
import { Attachment, AttachmentPreview } from '../../models/attachment.model';

@Component({
  selector: 'app-attachment-preview',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './attachment-preview.component.html',
  styleUrls: ['./attachment-preview.component.css']
})
export class AttachmentPreviewComponent implements OnChanges {
  @Input() attachment!: Attachment;
  @Input() showProgress = true;
  @Input() removable = true;
  @Output() remove = new EventEmitter<string>();
  @Output() retry = new EventEmitter<string>();

  previewUrl: string | null = null;
  isLoading = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['attachment']) {
      this.generatePreview();
    }
  }

  private generatePreview(): void {
    if (this.attachment.type === 'image' && this.attachment.content) {
      this.previewUrl = this.attachment.content;
    } else if (this.attachment.url) {
      this.previewUrl = this.attachment.url;
    } else {
      this.previewUrl = null;
    }
  }

  onRemove(): void {
    this.remove.emit(this.attachment.id);
  }

  onRetry(): void {
    this.retry.emit(this.attachment.id);
  }

  getIcon(): string {
    switch (this.attachment.type) {
      case 'image': return 'image';
      case 'document': return 'file-text';
      case 'text': return 'paperclip';
      default: return 'upload';
    }
  }

  getStatusIcon(): string {
    switch (this.attachment.status) {
      case 'uploading': return 'loader-2';
      case 'error': return 'alert-circle';
      default: return '';
    }
  }

  getStatusColor(): string {
    switch (this.attachment.status) {
      case 'uploading': return 'text-blue-600';
      case 'processing': return 'text-orange-600';
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getThumbnailClass(): string {
    if (this.attachment.type === 'image') {
      return 'aspect-video object-cover rounded';
    }
    return 'w-full h-full flex items-center justify-center bg-gray-100 rounded';
  }
}
