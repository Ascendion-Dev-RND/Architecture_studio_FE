import { Component, HostListener, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { FileAttachmentComponent } from '../../components/file-attachment/file-attachment.component';
import { AttachmentChipsComponent } from '../../components/attachment-chips/attachment-chips.component';
import { UploadedFile } from '../../services/file-upload.service';
import { AttachmentService } from '../../services/attachment.service';
import { Attachment } from '../../models/attachment.model';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';
import { RequirementsAnalyzerComponent, DiscoveryResult } from '../../components/requirements-analyzer/requirements-analyzer.component';
import { DiagramType, PresetInfo } from '../../services/architecture.service';

/**
 * ArchitectureGenerator Component
 * 
 * Input page for the Architecture Generator feature.
 * Users describe their architecture requirements here before
 * being redirected to the interactive workspace.
 * 
 * Features:
 * - Text input for architecture description
 * - Paperclip button for file attachment (UI only)
 * - Diagram type selector dropdown
 * - Quick suggestion chips for common use cases
 * 
 * Navigation Flow:
 * User enters prompt → Selects diagram type → Clicks send → Redirected to /architecture-workspace
 * 
 * Route: "/architecture-generator"
 */
@Component({
  selector: 'app-architecture-generator',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, LucideAngularModule, FileAttachmentComponent, BreadcrumbComponent],
  templateUrl: './architecture-generator.component.html',
  styleUrls: ['./architecture-generator.component.css']
})
export class ArchitectureGeneratorComponent {

  private static readonly DEPLOYMENT_PROVIDER_PRESETS: PresetInfo[] = [
    { value: 'aws', label: 'AWS', icon: 'Cloud' },
    { value: 'azure', label: 'AZURE', icon: 'Cloud' },
    { value: 'gcp', label: 'GCP', icon: 'Cloud' },
    { value: 'on-prem', label: 'Onprem / Private Cloud', icon: 'ServerCog' },
    { value: 'hybrid', label: 'Hybrid', icon: 'CloudCog' },
    { value: 'multi-cloud', label: 'MultiCloud', icon: 'Network' },
  ];

  @ViewChild('fileAttachment') fileAttachment!: FileAttachmentComponent;

  input: string = '';
  isDropdownOpen: boolean = false;
  showAttachmentPanel: boolean = false;
  uploadedFiles: UploadedFile[] = [];
  attachmentContext: string = '';
  activeTab: 'recent' | 'all' = 'recent';
  showDiscoveryDialog: boolean = false;
  pastedAttachments: Attachment[] = [];
  workspaceId: string = this.generateWorkspaceId();
  providerValidationMessage: string = '';
  
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Architecture Workbench' }
  ];

  private static readonly CLOUD_PRESETS: PresetInfo[] = [
    { value: 'generic', label: 'Generic', icon: 'Box' },
    { value: 'aws', label: 'AWS Cloud Architecture', icon: 'Cloud' },
    { value: 'azure', label: 'Azure Cloud Architecture', icon: 'Cloud' },
    { value: 'gcp', label: 'GCP Cloud Architecture', icon: 'Cloud' },
    { value: 'hybrid', label: 'Hybrid Cloud Architecture', icon: 'CloudCog' },
  ];

  /**
   * Supported diagram view types per LLD §6.1 / §11.4. The seven legacy
   * view types (enterprise-context, capability-map, bpmn,
   * application-landscape, data-information, component-integration,
   * sequence, transition-roadmap) have been retired in favour of the five
   * v2-supported types below. The retired types are still accepted on
   * the wire by the BFF, which returns HTTP 410 with a chat-friendly
   * payload handled by {@link UnsupportedViewTypeHandlerService}.
   */
  diagramTypes: DiagramType[] = [
    {
      value: 'c4-context',
      label: 'C4 Context Diagram',
      description: 'Who uses the system and what it talks to — nothing inside',
      icon: 'Circle',
      canvasType: 'maxgraph'
    },
    {
      value: 'c4-container',
      label: 'C4 Container Diagram',
      description: 'Logical deployment units inside the system boundary',
      icon: 'Boxes',
      canvasType: 'maxgraph'
    },
    {
      value: 'c4-component',
      label: 'C4 Component Diagram',
      description: 'Internal structure of one container — layered components',
      icon: 'Layers',
      canvasType: 'maxgraph'
    },
    {
      value: 'deployment-infrastructure',
      label: 'Deployment / Infrastructure / Security',
      description: 'Cloud infrastructure, networking, and security zones',
      icon: 'Server',
      canvasType: 'maxgraph',
      presets: ArchitectureGeneratorComponent.DEPLOYMENT_PROVIDER_PRESETS
    },
    {
      value: 'cicd-pipeline',
      label: 'CI/CD Pipeline',
      description: 'Source → build → test → deploy stages with gates and artifacts',
      icon: 'GitBranch',
      canvasType: 'maxgraph'
    }
  ];

  selectedDiagramType: DiagramType = this.diagramTypes[0];
  selectedPreset: PresetInfo | null = null;
  isPresetDropdownOpen: boolean = false;

  /**
   * Quick suggestion prompts
   */
  suggestions: string[] = [
    'E-commerce',
    'Design a real-time messaging system',
    'Design a real-time messaging system',
  ];

  /**
   * Projects data — loaded from API (see ProjectsSectionComponent on home page)
   */
  projects: any[] = [];

  constructor(private router: Router, private attachmentService: AttachmentService) {
    this.attachmentService.getAttachments().subscribe(attachments => {
      this.pastedAttachments = attachments;
    });
  }

  onPromptPaste(event: ClipboardEvent): void {
    this.attachmentService.handlePaste(event).subscribe({
      next: (uploaded) => {
        if (uploaded.length > 0) {
          console.log('[ArchGenerator] Files pasted:', uploaded.map(a => a.name));
        }
      },
      error: (err) => console.error('[ArchGenerator] Paste failed:', err)
    });
  }

  onPromptDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.attachmentService.handleDrop(files).subscribe({
        next: (uploaded) => console.log('[ArchGenerator] Files dropped:', uploaded.map(a => a.name)),
        error: (err) => console.error('[ArchGenerator] Drop failed:', err)
      });
    }
  }

  onRemovePastedAttachment(id: string): void {
    this.attachmentService.removeAttachment(id);
  }

  /**
   * Get filtered projects based on active tab
   */
  getFilteredProjects() {
    if (this.activeTab === 'recent') {
      return this.projects.filter(p => p.isRecent);
    }
    return this.projects;
  }

  /**
   * Toggle dropdown visibility
   */
  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  /**
   * Select a diagram type
   */
  selectDiagramType(type: DiagramType): void {
    this.selectedDiagramType = type;
    this.isDropdownOpen = false;
    this.selectedPreset = null;
    this.providerValidationMessage = '';
    this.isPresetDropdownOpen = false;
  }

  /**
   * Toggle preset dropdown
   */
  togglePresetDropdown(event: Event): void {
    event.stopPropagation();
    this.isPresetDropdownOpen = !this.isPresetDropdownOpen;
    this.isDropdownOpen = false;
  }

  /**
   * Select a preset
   */
  selectPreset(preset: PresetInfo): void {
    this.selectedPreset = preset;
    this.providerValidationMessage = '';
    this.isPresetDropdownOpen = false;
  }

  get shouldShowProviderDropdown(): boolean {
    return this.selectedDiagramType.value === 'deployment-infrastructure';
  }

  get selectedPresetLabel(): string {
    return this.selectedPreset?.label || 'Select provider';
  }

  /**
   * Close dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.isDropdownOpen && !target.closest('.diagram-type-dropdown')) {
      this.isDropdownOpen = false;
    }
    if (this.isPresetDropdownOpen && !target.closest('.diagram-type-dropdown')) {
      this.isPresetDropdownOpen = false;
    }
  }

  /**
   * Toggle attachment panel visibility
   */
toggleAttachmentPanel(): void {
  this.showAttachmentPanel = !this.showAttachmentPanel;
}

  /**
   * Handle files changed from attachment component
   */
  onFilesChanged(files: UploadedFile[]): void {
    this.uploadedFiles = files;
  }

  /**
   * Handle context built from attachment component
   */
  onContextBuilt(context: string): void {
    this.attachmentContext = context;
  }

  /**
   * Handles send action — navigate directly to workspace
   * Discovery dialog will open on workspace screen
   */
  handleSend(event?: Event): void {
    console.log('handleSend called', { 
      input: this.input, 
      diagramType: this.selectedDiagramType,
      attachments: this.uploadedFiles.length 
    });
    
    if (event) {
      event.stopPropagation();
    }

    if (this.shouldShowProviderDropdown && !this.selectedPreset) {
      this.providerValidationMessage = 'Select a provider for Deployment / Infrastructure generation.';
      return;
    }
    
    const prompt = this.input.trim() || 'Generate architecture diagram';
    
    // Build full context with attachments
    let fullContext = '';
    if (this.attachmentContext) {
      fullContext = `[Attached Files Context]\n${this.attachmentContext}\n\n[User Request]\n${prompt}`;
    }

    // Build pasted file context
    const pastedDocs = this.pastedAttachments
      .filter(a => a.metadata?.extractedText)
      .map(a => a.metadata!.extractedText)
      .join('\n\n');
    if (pastedDocs) {
      fullContext = fullContext
        ? `${fullContext}\n\n[Pasted Files]\n${pastedDocs}`
        : `[Pasted Files]\n${pastedDocs}\n\n[User Request]\n${prompt}`;
    }
    
    // Navigate to workspace — composition endpoint handles intake internally.
    // If clarification is needed, it returns clarification_required and the workspace
    // shows the dialog with preloaded questions from the intake flow.
    this.router.navigate(['/architecture-workspace'], {
      state: { 
        prompt: prompt,
        diagramType: this.selectedDiagramType,
        preset: this.selectedPreset?.value || null,
        workspaceId: this.workspaceId,
        attachments: this.uploadedFiles,
        context: fullContext || undefined,
      }
    }).then(success => {
      console.log('Navigation to workspace:', success);
    }).catch(error => {
      console.error('Navigation error:', error);
    });
  }

  /**
   * Called when Requirements Analyzer completes — navigate to workspace
   */
  onDiscoveryComplete(result: DiscoveryResult): void {
    this.showDiscoveryDialog = false;

    if (this.shouldShowProviderDropdown && !this.selectedPreset) {
      this.providerValidationMessage = 'Select a provider for Deployment / Infrastructure generation.';
      return;
    }
    
    const prompt = result.enrichedPrompt || this.input.trim() || 'Generate architecture diagram';
    
    // Build full context with attachments
    let fullContext = '';
    if (this.attachmentContext) {
      fullContext = `[Attached Files Context]\n${this.attachmentContext}\n\n[User Request]\n${prompt}`;
    }
    
    this.router.navigate(['/architecture-workspace'], {
      state: { 
        prompt: prompt,
        diagramType: this.selectedDiagramType,
        preset: this.selectedPreset?.value || null,
        workspaceId: this.workspaceId,
        attachments: this.uploadedFiles,
        context: fullContext || undefined,
        intakeArtifactId: result.intakeArtifactId,
        discoveryAskSummary: result.askSummary,
        discoveryAnswers: result.answers,
        discoveryConfidence: result.confidence
      }
    }).then(success => {
      console.log('Navigation result:', success);
    }).catch(error => {
      console.error('Navigation error:', error);
    });
  }

  /**
   * Called when Requirements Analyzer dialog is closed without proceeding
   */
  onDiscoveryClosed(): void {
    this.showDiscoveryDialog = false;
  }

      handleEnhance(): void {
  if (this.input.trim()) {
    this.input = `Enhanced: ${this.input}`;
  }
}

openFilePicker(): void {
  this.showAttachmentPanel = false; // close dropdown (optional)

  setTimeout(() => {
    this.fileAttachment?.openFilePicker?.();
  }, 0);
}

removeFile(index: number): void {
  this.uploadedFiles.splice(index, 1);
  this.fileAttachment?.removeFile?.(index);
}

private generateWorkspaceId(): string {
  return 'ws-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

autoResize(event: any) {
  const textarea = event.target;
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
}
