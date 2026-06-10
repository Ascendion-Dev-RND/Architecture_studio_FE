import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';
import { FileUploadService, UploadedFile } from '../../services/file-upload.service';
import { AttachmentService } from "../../services/attachment.service";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: "message" | "request-card";
  isLoading?: boolean;
  deltaNotes?: string;
  isStreaming?: boolean;
}

@Component({
  selector: 'app-assessment-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './assessment-workspace.component.html',
  styleUrls: ['./assessment-workspace.component.css']
})
export class AssessmentWorkspaceComponent {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Architecture Assessment', link: '/architecture-assessment' },
    { label: 'Workspace' }
  ];

  chatMessages: ChatMessage[] = [];
  userInput: string = '';
  isChatCollapsed: boolean = false;
  isLoading: boolean = false;
  uploadedFiles: UploadedFile[] = [];
  activeTab: "chat" | "code" | "overview" | "insert" = "chat";
  fileAttachment: any;
  assessmentWorkspaceId: string = "";
  showAttachmentPanel: boolean = false;

  

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    public fileUploadService: FileUploadService,
    private attachmentService: AttachmentService,
  ) {
    // Get initial prompt from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    
    if (state?.prompt) {
      this.chatMessages.push({
        role: 'user',
        content: state.prompt,
        timestamp: new Date()
      });
      
      // Simulate initial response
      setTimeout(() => {
        this.chatMessages.push({
          role: 'assistant',
          content: 'I\'ll analyze your architecture comprehensively. I\'ll assess risks, NFRs, TOGAF alignment, and best practices compliance. Let me start the evaluation.',
          timestamp: new Date()
        });
      }, 1000);
    }
  }
  openFilePicker(): void {
    this.showAttachmentPanel = false; // close dropdown (optional)

    setTimeout(() => {
      this.fileAttachment?.openFilePicker?.();
    }, 0);
  }
  
  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.onFilesDropped(files);
    }
  }

  onFilesDropped(files: FileList): void {
    const fileArray = Array.from(files);
    console.log(
      "[Workspace] Files dropped:",
      fileArray.map((f) => f.name),
    );

    this.attachmentService.handleDrop(files, this.assessmentWorkspaceId).subscribe({
      next: (uploadedAttachments) => {
        console.log("[Workspace] Files uploaded:", uploadedAttachments);
      },
      error: (error) => {
        console.error("[Workspace] Upload failed:", error);
      },
    });
  }

  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
    this.fileAttachment?.removeFile?.(index);
  }

  handleEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;

    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.sendMessage();
    }
  }

  autoResize(event: any) {
    const textarea = event.target;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }

   onPaste(event: ClipboardEvent): void {
    // Let the attachment service handle file pastes
    this.attachmentService.handlePaste(event, this.assessmentWorkspaceId).subscribe({
      next: (uploadedAttachments: string | any[]) => {
        if (uploadedAttachments.length > 0) {
          console.log("[Workspace] Files pasted:", uploadedAttachments);
        }
      },
      error: (error) => {
        console.error("[Workspace] Paste failed:", error);
      },
    });
  }
  
  toggleChat(): void {
    this.isChatCollapsed = !this.isChatCollapsed;
  }

  sendMessage(): void {
    if (!this.userInput.trim()) {
      return;
    }

    this.chatMessages.push({
      role: 'user',
      content: this.userInput,
      timestamp: new Date()
    });

    const userMsg = this.userInput;
    this.userInput = '';

    // Simulate AI response
    setTimeout(() => {
      this.chatMessages.push({
        role: 'assistant',
        content: this.getSimulatedResponse(userMsg),
        timestamp: new Date()
      });
    }, 1000);
  }

  private getSimulatedResponse(userMsg: string): string {
    const lowerMsg = userMsg.toLowerCase();
    
    if (lowerMsg.includes('security') || lowerMsg.includes('risk')) {
      return 'I\'ll prioritize security assessment. I\'ll evaluate authentication, authorization, encryption, and compliance with security frameworks like OWASP.';
    } else if (lowerMsg.includes('performance') || lowerMsg.includes('scalability')) {
      return 'For performance analysis, I\'ll assess latency, throughput, caching strategies, and horizontal scaling capabilities.';
    } else if (lowerMsg.includes('togaf') || lowerMsg.includes('framework')) {
      return 'I\'ll verify TOGAF ADM alignment, including business, data, application, and technology architecture domains.';
    } else if (lowerMsg.includes('cost') || lowerMsg.includes('optimize')) {
      return 'I can evaluate cost optimization opportunities including resource utilization, right-sizing, and architectural efficiency.';
    } else {
      return 'I understand. Let me incorporate that into the assessment. What other areas should I focus on?';
    }
  }

  viewReport(): void {
    this.router.navigate(['/architecture-assessment-report']);
  }
}
