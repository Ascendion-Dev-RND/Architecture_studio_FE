import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';
import {
  ArtifactService, ArtifactDoc, ArtifactPackDoc, ArtifactSection,
  ClarificationQuestion, ClarifyResponse, ArtifactWorkflowOptions, ArtifactWorkspaceArtifacts, ArtifactRequestSummary
} from '../../services/artifact.service';
import { Attachment } from '../../models/attachment.model';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isLoading?: boolean;
}

interface VersionEntry {
  version: number;
  timestamp: string;
  summary: string;
  sections: ArtifactSection[];
}

@Component({
  selector: 'app-artifact-hub-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './artifact-hub-workspace.component.html',
  styleUrls: ['./artifact-hub-workspace.component.css']
})
export class ArtifactHubWorkspaceComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatScroll') chatScrollRef?: ElementRef;
  private shouldScrollChat = false;

  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Artifact Hub', link: '/artifact-hub' },
    { label: 'Workspace' }
  ];

  // ── State ──────────────────────────────────────────────────────────────

  // Inputs from landing
  prompt: string = '';
  artifactTypes: string[] = [];
  sourceOption: string = 'none';
  reference: any = null;
  workspaceId: string = '';
  projectId: string = '';
  projectName: string = '';
  attachments: Attachment[] = [];

  // Workflow phase
  phase: 'clarification' | 'generating' | 'viewing' | 'error' = 'generating';

  // Clarification
  clarifyResponse: ClarifyResponse | null = null;
  clarificationAnswers: Record<string, string> = {};
  artifactRequests: ArtifactRequestSummary[] = [];
  showClarificationModal: boolean = false;

  // Generated pack
  pack: ArtifactPackDoc | null = null;
  activeArtifactIndex: number = 0;
  collapsedSections: Set<string> = new Set();

  // Chat
  isChatCollapsed: boolean = false;
  chatMessages: ChatMessage[] = [];
  userMessage: string = '';
  isChatLoading: boolean = false;

  // Version history
  showVersionHistory: boolean = false;
  versionHistory: VersionEntry[] = [];
  comparingVersion: VersionEntry | null = null;
  workspaceArtifacts: ArtifactWorkspaceArtifacts | null = null;

  // Export
  showExportMenu: boolean = false;

  // Loading / errors
  isLoading: boolean = false;
  errorMessage: string = '';
  loadingMessage: string = 'Generating artifacts...';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private artifactService: ArtifactService
  ) {}

  ngOnInit(): void {
    const state = history.state;
    if (state?.prompt) {
      this.prompt = state.prompt;
      this.artifactTypes = state.artifactTypes || [];
      this.sourceOption = state.sourceOption || 'none';
      this.reference = state.reference || null;
      this.workspaceId = state.workspaceId || this.reference?.workspaceId || this.reference?.projectId || this.reference?.id || `artifact-hub-${Date.now()}`;
      this.projectId = state.projectId || this.reference?.projectId || this.reference?.id || '';
      this.projectName = state.projectName || this.reference?.name || '';
      this.attachments = Array.isArray(state.attachments) ? state.attachments : [];

      this.chatMessages.push({
        role: 'user',
        content: this.prompt
      });

      // Start the workflow: clarify first, then generate
      this.runClarification();
    } else if (this.route.snapshot.queryParams['workspaceId']) {
      this.workspaceId = this.route.snapshot.queryParams['workspaceId'];
      this.projectId = this.route.snapshot.queryParams['projectId'] || '';
      this.projectName = this.route.snapshot.queryParams['projectName'] || '';
      this.loadWorkspaceArtifacts();
    } else {
      this.phase = 'error';
      this.errorMessage = 'No input provided. Please go back and configure your artifact generation.';
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollChat) {
      this.scrollChatToBottom();
      this.shouldScrollChat = false;
    }
  }

  // ── Clarification Phase ────────────────────────────────────────────────

  runClarification(): void {
    this.phase = 'clarification';
    this.isLoading = true;
    this.loadingMessage = 'Analyzing requirements...';

    this.artifactService.clarify(this.prompt, this.artifactTypes, this.buildWorkflowOptions()).subscribe({
      next: (resp) => {
        this.clarifyResponse = resp;
        this.artifactRequests = Array.isArray(resp.artifactRequests) ? resp.artifactRequests : [];
        const returnedAnswers = Array.isArray(resp.clarificationAnswers) ? resp.clarificationAnswers : [];
        for (const answer of returnedAnswers) {
          if (!answer?.questionId || !answer?.answer) {
            continue;
          }
          this.clarificationAnswers[answer.questionId] = answer.answer;
        }
        this.isLoading = false;
        this.showClarificationModal = false;

        if (resp.canSkip || resp.questions.length === 0) {
          this.chatMessages.push({
            role: 'assistant',
            content: 'Sufficient context found. Generating artifacts...'
          });
          this.generateArtifacts();
        } else {
          this.showClarificationModal = true;
          this.chatMessages.push({
            role: 'assistant',
            content: `I have ${resp.questions.length} clarification question(s) to improve artifact quality. Please answer them in the popup before generation.`
          });
          this.shouldScrollChat = true;
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.phase = 'error';
        this.showClarificationModal = false;
        this.errorMessage = err?.message || 'Artifact clarification failed. Please try again.';
        this.chatMessages.push({
          role: 'system',
          content: this.errorMessage
        });
        this.shouldScrollChat = true;
      }
    });
  }

  answerClarification(questionId: string, answer: string): void {
    this.clarificationAnswers[questionId] = answer;
  }

  setClarificationFreeText(questionId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (value) {
      this.clarificationAnswers[questionId] = value;
      return;
    }
    if (this.clarificationAnswers[questionId] && !this.isClarificationAnswerFromOptions(questionId)) {
      delete this.clarificationAnswers[questionId];
    }
  }

  getClarificationAnswer(questionId: string): string {
    return this.clarificationAnswers[questionId] || '';
  }

  isClarificationOptionSelected(questionId: string, option: string): boolean {
    return this.clarificationAnswers[questionId] === option;
  }

  isClarificationAnswerFromOptions(questionId: string): boolean {
    const question = this.clarifyResponse?.questions.find(q => q.id === questionId);
    if (!question) {
      return false;
    }
    return question.options.includes(this.clarificationAnswers[questionId] || '');
  }

  submitClarifications(): void {
    this.showClarificationModal = false;
    this.chatMessages.push({
      role: 'system',
      content: `Clarifications provided: ${Object.keys(this.clarificationAnswers).length} answer(s).`
    });
    this.generateArtifacts();
  }

  skipClarifications(): void {
    this.showClarificationModal = false;
    this.chatMessages.push({ role: 'system', content: 'Clarifications skipped.' });
    this.generateArtifacts();
  }

  closeClarificationModal(): void {
    this.showClarificationModal = false;
  }

  get answeredCount(): number {
    return Object.keys(this.clarificationAnswers).filter(key => !!this.clarificationAnswers[key]?.trim()).length;
  }

  get requiredUnanswered(): number {
    if (!this.clarifyResponse) {
      return 0;
    }
    return this.clarifyResponse.questions
      .filter(question => question.required && !this.clarificationAnswers[question.id]?.trim())
      .length;
  }

  get sufficiencyPercent(): number {
    return Math.round((this.clarifyResponse?.sufficiency || 0) * 100);
  }

  getQuestionCategories(): string[] {
    if (!this.clarifyResponse) return [];
    const cats = new Set(this.clarifyResponse.questions.map(q => q.category));
    return Array.from(cats);
  }

  getQuestionsForCategory(category: string): ClarificationQuestion[] {
    if (!this.clarifyResponse) return [];
    return this.clarifyResponse.questions.filter(q => q.category === category);
  }

  // ── Generation Phase ───────────────────────────────────────────────────

  generateArtifacts(): void {
    this.phase = 'generating';
    this.isLoading = true;
    this.loadingMessage = 'Generating artifacts...';
    this.errorMessage = '';
    this.showClarificationModal = false;

    const clars = Object.keys(this.clarificationAnswers).length > 0 ? this.clarificationAnswers : undefined;

    this.artifactService.generate(this.prompt, this.artifactTypes, clars, this.buildWorkflowOptions()).subscribe({
      next: (pack) => {
        this.pack = pack;
        this.activeArtifactIndex = 0;
        this.isLoading = false;
        this.phase = 'viewing';

        this.seedLocalVersionHistory();
        this.loadWorkspaceArtifacts();

        this.chatMessages.push({
          role: 'assistant',
          content: `Generated ${pack.artifacts.length} artifact(s). You can review, refine sections via chat, or export.`
        });
        this.shouldScrollChat = true;
      },
      error: (err) => {
        this.isLoading = false;
        this.phase = 'error';
        this.errorMessage = err.message || 'Artifact generation failed. Backend services may be unavailable.';
      }
    });
  }

  // ── Viewing Helpers ────────────────────────────────────────────────────

  get activeArtifact(): ArtifactDoc | null {
    if (!this.pack || this.pack.artifacts.length === 0) return null;
    return this.pack.artifacts[this.activeArtifactIndex] || null;
  }

  get sortedSections(): ArtifactSection[] {
    if (!this.activeArtifact) return [];
    return [...this.activeArtifact.sections].sort((a, b) => a.order - b.order);
  }

  selectArtifact(index: number): void {
    this.activeArtifactIndex = index;
    this.collapsedSections.clear();
    this.syncVersionHistoryFromWorkspace();
  }

  toggleSection(sectionId: string): void {
    if (this.collapsedSections.has(sectionId)) {
      this.collapsedSections.delete(sectionId);
    } else {
      this.collapsedSections.add(sectionId);
    }
  }

  isSectionCollapsed(sectionId: string): boolean {
    return this.collapsedSections.has(sectionId);
  }

  getSectionIcon(type: string): string {
    const icons: Record<string, string> = {
      'markdown': 'file-text',
      'table': 'grid-2x2',
      'checklist': 'check-circle',
      'yaml': 'code',
      'json': 'code',
    };
    return icons[type] || 'file-text';
  }

  getArtifactTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'ARD': 'ARD',
      'HLD': 'HLD',
      'LLD': 'LLD',
      'OPENAPI': 'OpenAPI Spec',
      'ADR': 'ADR',
      'OTHER': 'Other',
    };
    return labels[type] || type;
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  }

  isTableContent(content: any): boolean {
    return Array.isArray(content) && content.length > 0 && typeof content[0] === 'object';
  }

  isChecklistContent(content: any): boolean {
    return Array.isArray(content) && content.length > 0 && content[0]?.item !== undefined;
  }

  getTableHeaders(content: any[]): string[] {
    if (!content || content.length === 0) return [];
    return Object.keys(content[0]);
  }

  toggleChecklistItem(sectionId: string, index: number): void {
    if (!this.activeArtifact) return;
    const section = this.activeArtifact.sections.find(s => s.id === sectionId);
    if (section && Array.isArray(section.content) && section.content[index]) {
      section.content[index].checked = !section.content[index].checked;
    }
  }

  // ── Chat & Refinement ──────────────────────────────────────────────────

  toggleChat(): void {
    this.isChatCollapsed = !this.isChatCollapsed;
  }

  sendMessage(): void {
    if (!this.userMessage.trim() || this.isChatLoading || !this.activeArtifact) return;

    const msg = this.userMessage.trim();
    this.chatMessages.push({ role: 'user', content: msg });
    this.userMessage = '';
    this.isChatLoading = true;
    this.shouldScrollChat = true;

    const loadingMsg: ChatMessage = { role: 'assistant', content: 'Refining...', isLoading: true };
    this.chatMessages.push(loadingMsg);

    this.artifactService.refine(this.activeArtifact, msg, undefined, this.buildWorkflowOptions()).subscribe({
      next: (resp) => {
        this.isChatLoading = false;
        const idx = this.chatMessages.indexOf(loadingMsg);
        if (idx > -1) this.chatMessages.splice(idx, 1);

        if (resp.artifact && this.pack && this.activeArtifact) {
          this.pack.artifacts[this.activeArtifactIndex] = resp.artifact;
        }

        if (resp.updatedSections && resp.updatedSections.length > 0 && this.activeArtifact) {
          for (const updated of resp.updatedSections) {
            const existing = this.activeArtifact.sections.find(s => s.id === updated.id);
            if (existing) {
              existing.content = updated.content;
              existing.status = updated.status || 'draft';
            }
          }

          // Bump version
          const newVersion = resp.newVersion || (this.versionHistory.length + 1);
          this.versionHistory.push({
            version: newVersion,
            timestamp: new Date().toISOString(),
            summary: resp.deltaNotes || msg,
            sections: JSON.parse(JSON.stringify(this.activeArtifact.sections))
          });

          if (this.activeArtifact.metadata) {
            this.activeArtifact.metadata.version = newVersion;
          }
        }

        this.loadWorkspaceArtifacts();

        this.chatMessages.push({
          role: 'assistant',
          content: resp.deltaNotes || `Refined ${resp.updatedSections?.length || 0} section(s).`
        });
        this.shouldScrollChat = true;
      },
      error: () => {
        this.isChatLoading = false;
        const idx = this.chatMessages.indexOf(loadingMsg);
        if (idx > -1) this.chatMessages.splice(idx, 1);
        this.chatMessages.push({ role: 'assistant', content: 'Refinement failed. Please try again.' });
        this.shouldScrollChat = true;
      }
    });
  }

  refineSection(sectionId: string): void {
    this.userMessage = `Improve the "${this.activeArtifact?.sections.find(s => s.id === sectionId)?.title}" section`;
    this.isChatCollapsed = false;
  }

  regenerateSection(sectionId: string): void {
    const section = this.activeArtifact?.sections.find(s => s.id === sectionId);
    if (section) {
      this.userMessage = `Regenerate the "${section.title}" section with more detail`;
      this.sendMessage();
    }
  }

  // ── Version History ────────────────────────────────────────────────────

  toggleVersionHistory(): void {
    this.showVersionHistory = !this.showVersionHistory;
    this.comparingVersion = null;
  }

  compareVersion(entry: VersionEntry): void {
    this.comparingVersion = this.comparingVersion === entry ? null : entry;
  }

  restoreVersion(entry: VersionEntry): void {
    if (!this.activeArtifact) return;
    this.activeArtifact.sections = JSON.parse(JSON.stringify(entry.sections));
    this.chatMessages.push({ role: 'system', content: `Restored to version ${entry.version}.` });
    this.showVersionHistory = false;
    this.comparingVersion = null;
    this.shouldScrollChat = true;
  }

  // ── Export ─────────────────────────────────────────────────────────────

  toggleExportMenu(): void {
    this.showExportMenu = !this.showExportMenu;
  }

  exportAs(format: string): void {
    if (!this.activeArtifact) return;
    this.showExportMenu = false;

    this.artifactService.export(this.activeArtifact, format).subscribe({
      next: (resp) => {
        const blob = new Blob([resp.content], { type: resp.contentType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resp.filename;
        a.click();
        URL.revokeObjectURL(url);
        this.chatMessages.push({ role: 'system', content: `Exported: ${resp.filename}` });
      },
      error: () => {
        this.chatMessages.push({ role: 'assistant', content: 'Export failed.' });
      }
    });
  }

  copyToClipboard(): void {
    if (!this.activeArtifact) return;
    const text = this.activeArtifact.sections.map(s => {
      if (typeof s.content === 'string') return s.content;
      return JSON.stringify(s.content, null, 2);
    }).join('\n\n');
    navigator.clipboard.writeText(text);
    this.chatMessages.push({ role: 'system', content: 'Copied to clipboard.' });
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  backToHub(): void {
    this.router.navigate(['/artifact-hub']);
  }

  retryGeneration(): void {
    this.errorMessage = '';
    this.showClarificationModal = false;
    if (this.prompt) {
      this.runClarification();
      return;
    }
    this.loadWorkspaceArtifacts();
  }

  private scrollChatToBottom(): void {
    if (this.chatScrollRef?.nativeElement) {
      this.chatScrollRef.nativeElement.scrollTop = this.chatScrollRef.nativeElement.scrollHeight;
    }
  }

  private buildWorkflowOptions(): ArtifactWorkflowOptions {
    return {
      workspaceId: this.workspaceId,
      projectId: this.projectId,
      projectName: this.projectName,
      references: this.reference ? [this.reference] : undefined,
      attachments: this.attachments,
      artifactRequests: this.artifactRequests,
    };
  }

  private loadWorkspaceArtifacts(): void {
    if (!this.workspaceId) {
      return;
    }
    this.isLoading = true;
    this.loadingMessage = 'Loading workspace artifacts...';
    this.artifactService.listWorkspaceArtifacts(this.workspaceId).subscribe({
      next: (workspaceArtifacts) => {
        this.workspaceArtifacts = workspaceArtifacts;
        if ((!this.pack || this.pack.artifacts.length === 0) && workspaceArtifacts.generatedArtifacts.length > 0) {
          this.pack = {
            packId: `workspace-${this.workspaceId}`,
            artifacts: this.selectLatestArtifacts(workspaceArtifacts.generatedArtifacts),
            referencesUsed: [],
            metadata: {
              createdAt: new Date().toISOString(),
              version: 1,
              artifactTypes: this.artifactTypes.length > 0
                ? this.artifactTypes
                : this.selectLatestArtifacts(workspaceArtifacts.generatedArtifacts).map(artifact => artifact.artifactType),
            }
          };
          this.activeArtifactIndex = 0;
          this.phase = 'viewing';
        }
        this.syncVersionHistoryFromWorkspace();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        if (!this.pack || this.pack.artifacts.length === 0) {
          this.phase = 'error';
          this.errorMessage = 'Unable to load workspace artifacts.';
        }
      }
    });
  }

  private seedLocalVersionHistory(): void {
    if (!this.activeArtifact) {
      this.versionHistory = [];
      return;
    }
    this.versionHistory = [{
      version: this.activeArtifact.metadata?.version || 1,
      timestamp: new Date().toISOString(),
      summary: 'Initial generation',
      sections: JSON.parse(JSON.stringify(this.activeArtifact.sections))
    }];
  }

  private syncVersionHistoryFromWorkspace(): void {
    if (!this.activeArtifact) {
      this.versionHistory = [];
      return;
    }
    const allArtifacts = this.workspaceArtifacts?.generatedArtifacts || [];
    const rootArtifactId = this.activeArtifact.rootArtifactId || this.activeArtifact.artifactId;
    const matching = allArtifacts
      .filter(artifact => (artifact.rootArtifactId || artifact.artifactId) === rootArtifactId)
      .sort((a, b) => (a.metadata?.version || 1) - (b.metadata?.version || 1));

    if (matching.length === 0) {
      return;
    }

    this.versionHistory = matching.map((artifact, index) => ({
      version: artifact.metadata?.version || index + 1,
      timestamp: index === matching.length - 1 ? new Date().toISOString() : new Date().toISOString(),
      summary: artifact.priorVersionArtifactId ? 'Artifact refinement' : 'Initial generation',
      sections: JSON.parse(JSON.stringify(artifact.sections))
    }));
  }

  private selectLatestArtifacts(artifacts: ArtifactDoc[]): ArtifactDoc[] {
    const latestByRoot = new Map<string, ArtifactDoc>();
    artifacts.forEach(artifact => {
      const key = artifact.rootArtifactId || artifact.artifactId;
      const current = latestByRoot.get(key);
      if (!current || (artifact.metadata?.version || 1) >= (current.metadata?.version || 1)) {
        latestByRoot.set(key, artifact);
      }
    });
    return Array.from(latestByRoot.values()).sort((a, b) => a.artifactType.localeCompare(b.artifactType));
  }
}
