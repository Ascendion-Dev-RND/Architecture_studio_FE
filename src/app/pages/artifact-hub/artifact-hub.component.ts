import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';
import { ArtifactService, ArtifactType } from '../../services/artifact.service';
import { ProjectService, Project } from '../../services/project.service';
import { AttachmentService } from '../../services/attachment.service';
import { Attachment } from '../../models/attachment.model';

interface ReferenceOption {
  id: string;
  type: 'blueprint' | 'workbench' | 'artifact';
  name: string;
  projectId?: string;
  workspaceId?: string;
  date?: string;
}

@Component({
  selector: 'app-artifact-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './artifact-hub.component.html',
  styleUrls: ['./artifact-hub.component.css']
})
export class ArtifactHubComponent implements OnInit {
  private readonly generatedWorkspaceId = `artifact-hub-${Date.now()}`;

  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Artifact Hub' }
  ];

  // Form state
  prompt: string = '';
  selectedTypes: Set<string> = new Set();
  selectedTypeId: string = '';
  attachedFiles: Attachment[] = [];
  selectedReference: ReferenceOption | null = null;
  sourceOption: 'none' | 'blueprint' | 'workbench' = 'none';
  workspaceId: string = '';
  projectId: string = '';
  projectName: string = '';
  presetReferenceId: string = '';

  // Data
  artifactTypes: ArtifactType[] = [];
  projects: Project[] = [];
  availableReferences: ReferenceOption[] = [];
  suggestions: string[] = [
    'Create an ARD for a customer support platform with CRM, chat, and analytics integrations.',
    'Generate an HLD for an event-driven order management system using Kafka and microservices.',
    'Draft an OpenAPI spec for partner onboarding APIs with authentication, quotas, and audit trails.'
  ];
  isLoadingTypes: boolean = true;
  isLoadingProjects: boolean = false;
  errorMessage: string = '';

  // Search/filter
  searchQuery: string = '';
  isTypeDropdownOpen: boolean = false;
  showAttachmentPanel: boolean = false;
  showRefDropdown: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private artifactService: ArtifactService,
    private projectService: ProjectService,
    private attachmentService: AttachmentService
  ) {}

  ngOnInit(): void {
    this.attachmentService.clearAttachments();
    this.loadArtifactTypes();
    this.loadProjects();

    // Check for query params (e.g., coming from workbench)
    const params = this.route.snapshot.queryParams;
    this.workspaceId = params['workspaceId'] || params['projectId'] || this.generatedWorkspaceId;
    this.projectId = params['projectId'] || '';
    this.presetReferenceId = params['projectId'] || '';
    if (params['artifactType']) {
      this.selectedTypeId = params['artifactType'].toUpperCase();
      this.selectedTypes = new Set([this.selectedTypeId]);
    }
    if (params['projectId']) {
      this.sourceOption = 'workbench';
    }
  }

  loadArtifactTypes(): void {
    this.isLoadingTypes = true;
    this.artifactService.listTypes().subscribe({
      next: (types) => {
        this.artifactTypes = types;
        if (!this.selectedTypeId && types.length > 0) {
          this.selectType(types[0].id);
        }
        this.isLoadingTypes = false;
      },
      error: () => {
        this.isLoadingTypes = false;
      }
    });
  }

  loadProjects(): void {
    this.isLoadingProjects = true;
    this.projectService.listProjects('active').subscribe({
      next: (projects) => {
        this.projects = projects;
        this.availableReferences = projects.map(p => ({
          id: p.id,
          type: (p.tags?.includes('blueprint') ? 'blueprint' : 'workbench') as 'blueprint' | 'workbench',
          name: p.name,
          projectId: p.id,
          workspaceId: this.resolveProjectWorkspaceId(p),
          date: p.updatedAt
        }));
        if (this.presetReferenceId && !this.selectedReference) {
          const preset = this.availableReferences.find(ref => ref.id === this.presetReferenceId || ref.projectId === this.presetReferenceId);
          if (preset) {
            this.selectRefOption(preset);
          }
        }
        this.isLoadingProjects = false;
      },
      error: () => {
        this.isLoadingProjects = false;
        this.availableReferences = [];
      }
    });
  }

  get selectedType(): ArtifactType | undefined {
    return this.artifactTypes.find(type => type.id === this.selectedTypeId);
  }

  selectType(typeId: string): void {
    this.selectedTypeId = typeId;
    this.selectedTypes = typeId ? new Set([typeId]) : new Set();
    this.isTypeDropdownOpen = false;
  }

  isTypeSelected(typeId: string): boolean {
    return this.selectedTypes.has(typeId);
  }

  getTypeIcon(typeId: string): string {
    const icons: Record<string, string> = {
      'ARD': 'clipboard-list',
      'HLD': 'layers-3',
      'LLD': 'component',
      'OPENAPI': 'code',
      'ADR': 'file-text',
      'OTHER': 'folder-kanban',
    };
    return icons[typeId] || 'file-text';
  }

  toggleTypeDropdown(event?: Event): void {
    event?.stopPropagation();
    this.isTypeDropdownOpen = !this.isTypeDropdownOpen;
    if (this.isTypeDropdownOpen) {
      this.showAttachmentPanel = false;
      this.showRefDropdown = false;
    }
  }

  toggleAttachmentPanel(event?: Event): void {
    event?.stopPropagation();
    this.showAttachmentPanel = !this.showAttachmentPanel;
    if (this.showAttachmentPanel) {
      this.isTypeDropdownOpen = false;
      this.showRefDropdown = false;
    }
  }

  toggleReferencePanel(event?: Event): void {
    event?.stopPropagation();
    this.sourceOption = this.sourceOption === 'none' ? 'workbench' : this.sourceOption;
    this.showRefDropdown = !this.showRefDropdown;
    if (this.showRefDropdown) {
      this.showAttachmentPanel = false;
      this.isTypeDropdownOpen = false;
    }
  }

  openFilePicker(fileInput: HTMLInputElement): void {
    this.showAttachmentPanel = false;
    fileInput.click();
  }

  handleFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      newFiles.forEach(file => {
        this.attachmentService.uploadFile({ file, workspaceId: this.workspaceId, sessionId: this.workspaceId }).subscribe({
          next: (attachment) => {
            this.attachedFiles = [...this.attachedFiles, attachment];
          },
          error: (error) => {
            this.errorMessage = error?.message || `Failed to attach ${file.name}`;
          }
        });
      });
      input.value = '';
    }
  }

  onPromptPaste(event: ClipboardEvent): void {
    this.attachmentService.handlePaste(event, this.workspaceId, this.workspaceId).subscribe({
      next: (uploaded) => {
        if (uploaded.length > 0) {
          this.attachedFiles = [...this.attachedFiles, ...uploaded];
        }
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to paste attachment(s).';
      }
    });
  }

  onPromptDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onPromptDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    this.attachmentService.handleDrop(files, this.workspaceId, this.workspaceId).subscribe({
      next: (uploaded) => {
        if (uploaded.length > 0) {
          this.attachedFiles = [...this.attachedFiles, ...uploaded];
        }
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to attach dropped files.';
      }
    });
  }

  removeFile(index: number): void {
    const removed = this.attachedFiles[index];
    if (removed) {
      this.attachmentService.removeAttachment(removed.id);
    }
    this.attachedFiles.splice(index, 1);
  }

  selectRefOption(ref: ReferenceOption): void {
    this.selectedReference = ref;
    this.workspaceId = ref.workspaceId || ref.projectId || ref.id;
    this.projectId = ref.projectId || ref.id;
    this.projectName = ref.name;
    this.sourceOption = ref.type === 'blueprint' ? 'blueprint' : 'workbench';
    this.showRefDropdown = false;
  }

  private resolveProjectWorkspaceId(project: Project): string | undefined {
    const metadata = project.metadata;
    if (!metadata || typeof metadata !== 'object') {
      return undefined;
    }
    return metadata.workspaceId || metadata.workspace_id || undefined;
  }

  clearReference(): void {
    this.selectedReference = null;
    this.sourceOption = 'none';
    this.workspaceId = this.route.snapshot.queryParams['workspaceId'] || this.route.snapshot.queryParams['projectId'] || this.generatedWorkspaceId;
    this.projectId = this.route.snapshot.queryParams['projectId'] || '';
    this.projectName = '';
    this.showRefDropdown = false;
  }

  get filteredReferences(): ReferenceOption[] {
    if (!this.searchQuery) return this.availableReferences;
    const q = this.searchQuery.toLowerCase();
    return this.availableReferences.filter(r =>
      r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
    );
  }

  canGenerate(): boolean {
    return this.prompt.trim().length > 5
      && !!this.selectedTypeId
      && this.attachedFiles.every(file => file.status === 'completed');
  }

  autoResize(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.isTypeDropdownOpen && !target.closest('.artifact-type-dropdown')) {
      this.isTypeDropdownOpen = false;
    }
    if (this.showAttachmentPanel && !target.closest('.artifact-attachment-dropdown')) {
      this.showAttachmentPanel = false;
    }
    if (this.showRefDropdown && !target.closest('.artifact-reference-dropdown')) {
      this.showRefDropdown = false;
    }
  }

  generate(): void {
    if (!this.canGenerate()) return;
    this.errorMessage = '';

    this.router.navigate(['/artifact-hub/workspace'], {
      state: {
        prompt: this.prompt,
        artifactTypes: this.selectedTypeId ? [this.selectedTypeId] : Array.from(this.selectedTypes),
        attachments: this.attachedFiles,
        reference: this.selectedReference,
        sourceOption: this.sourceOption,
        workspaceId: this.selectedReference?.workspaceId || this.workspaceId || this.generatedWorkspaceId,
        projectId: this.selectedReference?.projectId || this.projectId || '',
        projectName: this.selectedReference?.name || this.projectName || '',
      }
    });
  }
}
