import { Component, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { FileAttachmentComponent } from '../../components/file-attachment/file-attachment.component';
import { UploadedFile } from '../../services/file-upload.service';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

/**
 * ArchitectureAssessment Component
 * 
 * Input page for the Architecture Assessment feature.
 */
@Component({
  selector: 'app-architecture-assessment',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, LucideAngularModule, FileAttachmentComponent, BreadcrumbComponent],
  templateUrl: './architecture-assessment.component.html',
  styleUrls: ['./architecture-assessment.component.css']
})
export class ArchitectureAssessmentComponent {
  input: string = '';
  showAttachmentPanel: boolean = false;
  uploadedFiles: UploadedFile[] = [];
  attachmentContext: string = '';
  activeTab: 'recent' | 'all' = 'recent';
  
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Architecture Assessment' }
  ];

  projects = [
    {
      title: 'Cloud Security Assessment',
      description: 'Review, validate, and assess architecture for risks, NFRs, TOGAF and best-practices',
      author: 'Sarah Chen',
      timestamp: '1 day ago',
      isRecent: true,
      isNew: true
    },
    {
      title: 'Microservices Review',
      description: 'Review, validate, and assess architecture for risks, NFRs, TOGAF and best-practices',
      author: 'Marcus Johnson',
      timestamp: '3 days ago',
      isRecent: true,
      isNew: false
    },
    {
      title: 'Legacy System Audit',
      description: 'Review, validate, and assess architecture for risks, NFRs, TOGAF and best-practices',
      author: 'Alex Kumar',
      timestamp: '1 week ago',
      isRecent: false,
      isNew: false
    }
  ];
  @ViewChild('fileAttachment') fileAttachment!: FileAttachmentComponent;
  constructor(private router: Router) {}

  getFilteredProjects() {
    if (this.activeTab === 'recent') {
      return this.projects.filter(p => p.isRecent);
    }
    return this.projects;
  }

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
      
      this.router.navigate(['/assessment-workspace'], {
        state: { 
          prompt: this.input,
          attachments: this.uploadedFiles,
          context: fullContext || undefined
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
