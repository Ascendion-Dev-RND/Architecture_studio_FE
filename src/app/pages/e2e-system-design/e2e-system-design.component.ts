import { Component, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { FileAttachmentComponent } from '../../components/file-attachment/file-attachment.component';
import { UploadedFile } from '../../services/file-upload.service';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

/**
 * E2ESystemDesign Component (Solution Blueprint)
 * 
 * Input page for the Solution Blueprint feature.
 */
@Component({
  selector: 'app-e2e-system-design',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, LucideAngularModule, FileAttachmentComponent, BreadcrumbComponent],
  templateUrl: './e2e-system-design.component.html',
  styleUrls: ['./e2e-system-design.component.css']
})
export class E2ESystemDesignComponent {
  input: string = '';
  showAttachmentPanel: boolean = false;
  uploadedFiles: UploadedFile[] = [];
  attachmentContext: string = '';
  
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Solution Blueprint' }
  ];

  @ViewChild('fileAttachment') fileAttachment!: FileAttachmentComponent;

  constructor(private router: Router) {}

  toggleAttachmentPanel(): void {
    this.showAttachmentPanel = !this.showAttachmentPanel;
  }

  onFilesChanged(files: UploadedFile[]): void {
    this.uploadedFiles = files;
  }

  onContextBuilt(context: string): void {
    this.attachmentContext = context;
  }

  handleSend(): void {
    if (this.input.trim() || this.uploadedFiles.length > 0) {
      let fullContext = '';
      if (this.attachmentContext) {
        fullContext = `[Attached Files Context]\n${this.attachmentContext}\n\n[User Request]\n${this.input}`;
      }

      // Auto-detect mode: brownfield if architecture artifacts are uploaded
      const hasArchArtifact = this.uploadedFiles.some(f =>
        /\.(drawio|xml|png|jpg|jpeg|pdf)$/i.test(f.name)
      );
      const promptLower = this.input.toLowerCase();
      const brownfieldSignals = ['existing', 'legacy', 'migrate', 'modernize', 'enhance', 'upgrade', 'extend', 'brownfield', 'current'];
      const isBrownfield = hasArchArtifact || brownfieldSignals.some(s => promptLower.includes(s));

      this.router.navigate(['/solution-blueprint-workspace'], {
        state: {
          prompt: this.input,
          attachments: this.uploadedFiles,
          context: fullContext || undefined,
          mode: isBrownfield ? 'brownfield' : 'greenfield'
        }
      });
    }
  }

  handleEnhance(): void {
    if (this.input.trim()) {
      this.input = `Enhanced: ${this.input}`;
    }
  }

  openFilePicker(): void {
  this.showAttachmentPanel = false;

  setTimeout(() => {
    this.fileAttachment?.openFilePicker?.();
  }, 0);
}

removeFile(index: number): void {
  this.uploadedFiles.splice(index, 1);
  this.fileAttachment?.removeFile?.(index);
}
}
