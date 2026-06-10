import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, FileText, Image, Paperclip, Loader2, CheckCircle, AlertCircle } from 'lucide-angular';
import { Attachment } from '../../models/attachment.model';
import { AttachmentService } from '../../services/attachment.service';

@Component({
  selector: 'app-attachment-chips',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './attachment-chips.component.html',
  styleUrls: ['./attachment-chips.component.css']
})
export class AttachmentChipsComponent implements OnChanges {
  @Input() attachments: Attachment[] = [];
  @Input() compact = false;
  @Input() showStatus = true;
  @Output() remove = new EventEmitter<string>();
  @Output() retry = new EventEmitter<string>();

  constructor(private attachmentService: AttachmentService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['attachments']) {
      // Auto-remove completed attachments after 5 minutes
      this.scheduleCleanup();
    }
  }

  onRemove(id: string): void {
    this.remove.emit(id);
    this.attachmentService.removeAttachment(id);
  }

  onRetry(id: string): void {
    this.retry.emit(id);
    // Could implement retry logic here
  }

  getTotalSize(): string {
    const total = this.attachments.reduce((sum, a) => sum + a.size, 0);
    return this.formatFileSize(total);
  }

  hasCompletedAttachments(): boolean {
    return this.attachments.some(a => a.status === 'completed');
  }

  hasUploadingAttachments(): boolean {
    return this.attachments.some(a => a.status === 'uploading');
  }

  hasErrorAttachments(): boolean {
    return this.attachments.some(a => a.status === 'error');
  }

  getAttachmentCount(): number {
    return this.attachments.length;
  }

  getVisibleAttachments(): Attachment[] {
    if (this.compact) {
      return this.attachments.slice(-3); // Show last 3 in compact mode
    }
    return this.attachments;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  trackByAttachmentId(index: number, attachment: Attachment): string {
    return attachment.id;
  }

  private scheduleCleanup(): void {
    // Auto-remove completed attachments after 5 minutes
    const completedAttachments = this.attachments.filter(a => a.status === 'completed');
    if (completedAttachments.length > 0) {
      setTimeout(() => {
        completedAttachments.forEach(a => {
          this.attachmentService.removeAttachment(a.id);
        });
      }, 5 * 60 * 1000); // 5 minutes
    }
  }

  getIconForType(type: string): string {
    switch (type) {
      case 'image': return 'image';
      case 'document': return 'file-text';
      case 'text': return 'paperclip';
      default: return 'upload';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'uploading': return 'loader-2';
      case 'processing': return 'loader-2';
      case 'completed': return 'check-circle';
      case 'error': return 'alert-circle';
      default: return '';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'uploading': return 'text-blue-600';
      case 'processing': return 'text-orange-600';
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }
}
