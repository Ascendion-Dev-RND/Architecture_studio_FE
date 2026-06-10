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
  template: `
  <app-file-attachment
    #fileAttachment
    class="hidden"
    [multiple]="true"
    [showDropZone]="false"
    [context]="'all'"
    [maxFiles]="5"
    (filesChanged)="onFilesChanged($event)"
    (contextBuilt)="onContextBuilt($event)"
  ></app-file-attachment>

  <div class="min-h-screen gradient-hero">
    <app-breadcrumb [items]="breadcrumbItems" />

    <main class="pt-32 pb-20 px-6">
      <div class="container mx-auto max-w-4xl text-center">

        <!-- Title -->
        <h1 class="mb-4 text-5xl font-medium">
          Solution Blueprint
        </h1>

        <p class="mb-12 text-muted-foreground text-lg max-w-2xl mx-auto">
          Convert requirements into complete solution blueprints
        </p>

        <!-- Card -->
        <div class="bg-card rounded-2xl p-8 card-shadow max-w-3xl mx-auto">

          <!-- Input -->
          <div class="mb-4">
            <input
              type="text"
              [(ngModel)]="input"
              (keyup.enter)="handleSend()"
              placeholder="Describe your system requirements..."
              class="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-lg outline-none"
            />
          </div>

          <!-- ✅ FILE CHIPS (correct position) -->
          <div *ngIf="uploadedFiles.length > 0"
               class="mb-4 flex flex-wrap gap-2">

            <div
              *ngFor="let file of uploadedFiles; let i = index"
              class="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-sm"
            >
              <lucide-icon name="FileText" class="w-3 h-3"></lucide-icon>

              <span class="max-w-[120px] truncate">
                {{ file.name }}
              </span>

              <button
                type="button"
                (click)="removeFile(i)"
                class="ml-1 text-gray-500 hover:text-red-500"
              >
                <lucide-icon name="X" class="w-3 h-3"></lucide-icon>
              </button>
            </div>
          </div>

          <!-- Buttons Row -->
          <div class="flex items-center justify-between">

            <!-- LEFT: Attachment -->
            <div class="flex items-center gap-3">

              <div class="relative">

                <!-- 📎 Button -->
                <button
                  type="button"
                  (click)="toggleAttachmentPanel()"
                  [class.text-primary]="uploadedFiles.length > 0"
                  class="p-2 text-muted-foreground hover:text-foreground transition-colors relative"
                >
                  <lucide-icon name="Paperclip" class="w-5 h-5"></lucide-icon>

                  <span *ngIf="uploadedFiles.length > 0"
                        class="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[10px] flex items-center justify-center text-white">
                    {{ uploadedFiles.length }}
                  </span>
                </button>

                <!-- Dropdown -->
                <div
                  *ngIf="showAttachmentPanel"
                  class="absolute top-full mt-2 w-72 bg-card rounded-lg card-shadow border border-border/50 py-2 z-50"
                >
                  <button
                    (click)="openFilePicker()"
                    class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg"
                  >
                    <lucide-icon name="FileUp" class="w-4 h-4"></lucide-icon>
                    Upload files
                  </button>
                </div>

              </div>

            </div>

            <!-- RIGHT: Actions -->
            <div class="flex items-center gap-3">

              <button
                (click)="handleEnhance()"
                class="p-2 text-muted-foreground hover:text-amber-500 transition-colors"
              >
                <lucide-icon name="Wand" class="w-5 h-5"></lucide-icon>
              </button>

              <button
                (click)="handleSend()"
                class="p-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <lucide-icon name="Send" class="w-5 h-5"></lucide-icon>
              </button>

            </div>
          </div>

        </div>
      </div>
       <!-- Information Section -->
          <div class="mt-20 text-left max-w-5xl mx-auto">
            <!-- Features Grid -->
            <div class="grid md:grid-cols-3 gap-6 mb-16">
              <div class="bg-card rounded-xl p-6 card-shadow">
                <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <lucide-icon name="Layers" class="w-6 h-6 text-primary"></lucide-icon>
                </div>
                <h3 class="text-xl font-semibold mb-3 text-foreground">Complete System Design</h3>
                <p class="text-muted-foreground">
                  Transform requirements into comprehensive end-to-end solutions covering all architectural layers.
                </p>
              </div>

              <div class="bg-card rounded-xl p-6 card-shadow">
                <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <lucide-icon name="FileText" class="w-6 h-6 text-primary"></lucide-icon>
                </div>
                <h3 class="text-xl font-semibold mb-3 text-foreground">Detailed Documentation</h3>
                <p class="text-muted-foreground">
                  Receive comprehensive documentation including architecture diagrams, component specs, and integration guides.
                </p>
              </div>

              <div class="bg-card rounded-xl p-6 card-shadow">
                <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <lucide-icon name="GitBranch" class="w-6 h-6 text-primary"></lucide-icon>
                </div>
                <h3 class="text-xl font-semibold mb-3 text-foreground">Implementation Ready</h3>
                <p class="text-muted-foreground">
                  Get actionable specifications ready for development teams with clear technical guidelines.
                </p>
              </div>
            </div>

            <!-- What's Included -->
            <div class="bg-card rounded-xl p-8 card-shadow mb-16">
              <h2 class="text-2xl font-bold mb-6 text-foreground flex items-center gap-3">
                <lucide-icon name="Package" class="w-6 h-6 text-primary"></lucide-icon>
                What's Included in E2E Design
              </h2>
              <div class="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 class="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <lucide-icon name="Box" class="w-4 h-4 text-primary"></lucide-icon>
                    System Architecture
                  </h4>
                  <ul class="space-y-2 text-sm text-muted-foreground">
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>High-level architecture overview and diagrams</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Component and service breakdown</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Technology stack recommendations</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 class="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <lucide-icon name="Database" class="w-4 h-4 text-primary"></lucide-icon>
                    Data Architecture
                  </h4>
                  <ul class="space-y-2 text-sm text-muted-foreground">
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Data models and entity relationships</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Database schema design</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Data flow and integration patterns</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 class="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <lucide-icon name="Cloud" class="w-4 h-4 text-primary"></lucide-icon>
                    Infrastructure Design
                  </h4>
                  <ul class="space-y-2 text-sm text-muted-foreground">
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Cloud infrastructure architecture</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Deployment strategies and CI/CD pipelines</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Scalability and high-availability setup</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 class="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <lucide-icon name="Shield" class="w-4 h-4 text-primary"></lucide-icon>
                    Security & Compliance
                  </h4>
                  <ul class="space-y-2 text-sm text-muted-foreground">
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Security architecture and threat modeling</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Authentication and authorization design</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary mt-1">•</span>
                      <span>Compliance considerations and controls</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Process Flow -->
            <div class="bg-card rounded-xl p-8 card-shadow">
              <h2 class="text-2xl font-bold mb-6 text-foreground flex items-center gap-3">
                <lucide-icon name="HelpCircle" class="w-6 h-6 text-primary"></lucide-icon>
                How It Works
              </h2>
              <div class="space-y-4">
                <div class="flex gap-4">
                  <div class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">1</div>
                  <div>
                    <h4 class="font-semibold text-foreground mb-1">Define Requirements</h4>
                    <p class="text-muted-foreground">Describe your business requirements, functional needs, and constraints in natural language.</p>
                  </div>
                </div>
                <div class="flex gap-4">
                  <div class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">2</div>
                  <div>
                    <h4 class="font-semibold text-foreground mb-1">AI Analysis</h4>
                    <p class="text-muted-foreground">Our AI analyzes requirements and generates comprehensive architecture across all layers.</p>
                  </div>
                </div>
                <div class="flex gap-4">
                  <div class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">3</div>
                  <div>
                    <h4 class="font-semibold text-foreground mb-1">Review & Export</h4>
                    <p class="text-muted-foreground">Review complete documentation with diagrams, specifications, and export for your development team.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

      </main>
    </div>
  `,
  styles: []
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
