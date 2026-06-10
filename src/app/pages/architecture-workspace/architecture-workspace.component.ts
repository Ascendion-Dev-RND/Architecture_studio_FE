import { Component, OnInit, ViewChild, OnDestroy, HostListener, ElementRef, AfterViewChecked } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { MermaidCanvasComponent } from '../../components/mermaid-canvas/mermaid-canvas.component';
import { MaxGraphCanvasComponent } from '../../components/maxgraph-canvas/maxgraph-canvas.component';
import { V2MaxGraphCanvasComponent } from '../../components/v2-maxgraph-canvas/v2-maxgraph-canvas.component';
import { ArchitectureService, DiagramType, TaskStatusResponse, ChatStreamEvent } from '../../services/architecture.service';
import { ProjectService } from '../../services/project.service';
import { WorkspaceStateService, ChatPresentationMessage, OverviewModel, WorkspaceState, WorkspaceGenerateRequest, ClarificationAnswer as StructuredClarificationAnswer } from '../../services/workspace-state.service';
import { WorkspaceWebSocketService, WsEvent, WsEditResult, WsConnectionState } from '../../services/workspace-websocket.service';
import { AttachmentService } from '../../services/attachment.service';
import { Attachment } from '../../models/attachment.model';
import { Subscription } from 'rxjs';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';
import { RequirementsAnalyzerComponent, DiscoveryResult } from '../../components/requirements-analyzer/requirements-analyzer.component';
import { ClarificationQuestionsComponent } from '../../components/clarification-questions/clarification-questions.component';
import { ComponentPanelComponent } from '../../components/component-panel/component-panel.component';
import { AttachmentChipsComponent } from '../../components/attachment-chips/attachment-chips.component';
import { FileAttachmentComponent } from '../../components/file-attachment/file-attachment.component';
import { FileUploadService, UploadedFile } from '../../services/file-upload.service';
import { WorkspaceJobEvent, WorkflowJobService, WorkspaceJobUpdate } from '../../services/workflow-job.service';
import { DiagramExportService, DiagramExportFormat } from '../../services/diagram-export.service';

/**
 * Chat Message Interface
 */
interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
  isDiscovery?: boolean;
}

interface ClarificationAnswer {
  questionId: string;
  question: string;
  answer: string;
}

interface WorkflowProgressStep {
  stage: string;
  message: string;
  status: 'active' | 'completed' | 'warning';
}

/**
 * ArchitectureWorkspace Component
 * 
 * Interactive workspace for architecture generation with chat and canvas.
 * Users arrive here after entering their prompt in the generator page.
 * The canvas type (mxGraph or Mermaid) is determined by the diagram type.
 */
@Component({
  selector: 'app-architecture-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    MermaidCanvasComponent,
    MaxGraphCanvasComponent,
    V2MaxGraphCanvasComponent,
    BreadcrumbComponent,
    RequirementsAnalyzerComponent,
    ClarificationQuestionsComponent,
    ComponentPanelComponent,
    FileAttachmentComponent
],
  templateUrl: './architecture-workspace.component.html',
  styleUrls: ['./architecture-workspace.component.css']
})
export class ArchitectureWorkspaceComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('maxgraphCanvas') maxgraphCanvas?: MaxGraphCanvasComponent;
  @ViewChild('v2canvas') v2canvas?: V2MaxGraphCanvasComponent;
  @ViewChild('mermaidCanvas') mermaidCanvas?: MermaidCanvasComponent;
  @ViewChild('chatContainer') chatContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('fileAttachment') fileAttachment!: FileAttachmentComponent;
  
  
  private shouldScrollToBottom = false;

  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Architecture Workbench', link: '/architecture-generator' },
    { label: 'Workspace' }
  ];

    showAttachmentPanel: boolean = false;
      uploadedFiles: UploadedFile[] = [];
        attachmentContext: string = '';

    


  prompt: string = '';
  chatInput: string = '';
  diagramType: DiagramType | null = null;
  preset: string | null = null;
  canvasType: 'maxgraph' | 'mermaid' | 'v2-maxgraph' = 'maxgraph';
  diagramData: any = null;
  /** v2 LayoutIR — populated when canvasType === 'v2-maxgraph'. */
  layoutIR: any = null;
  /** Persisted flat edit snapshot for the v2 canvas (manual edits) — replayed
   *  on reload so drag/insert/move survive without a recompose. */
  canvasSnapshot: any = null;
  /** True when the v2 canvas has unsaved manual edits (drives the Sync button). */
  canvasDirty = false;
  /** Spinner while the Sync save is in flight. */
  canvasSyncing = false;
  /** Diagram UUID for /diagrams/{id}/overview lookups. */
  diagramId: string | null = null;
  /** Cached overview narrative — fetched lazily when the Overview tab opens. */
  overviewPayload: any = null;
  overviewLoading = false;
  overviewError: string | null = null;
  /** layoutIR.version the rich overview was last loaded for, so the Overview
   *  tab fetches the narrator once per diagram version (and refreshes after a
   *  regenerate). */
  private overviewLoadedVersion: any = null;
  diagramName: string = '';
  isLoading: boolean = true;
  isChatLoading: boolean = false;
  chatMessages: ChatMessage[] = [];
  isChatCollapsed: boolean = false;
  activeTab: 'chat' | 'code' | 'overview' | 'insert' = 'chat';
  diagramCode: string = '';
  architectureOverview: string = '';
  workspaceId: string = '';
  taskProgress: number = 0;
  errorMessage: string = '';
  discoveryAnswers: ClarificationAnswer[] = [];
  discoveryConfidence: number = 0;
  resolvedSystemName: string = '';
  showDiscoveryDialog: boolean = false;
  originalPrompt: string = '';
  
  // Clarification questions state
  clarificationQuestions: string[] = [];
  showClarificationQuestions: boolean = false;
  
  // Intake clarification state (from composition endpoint)
  pendingIntakeArtifactId: string = '';
  preloadedIntakeQuestions: any[] = [];
  
  // Component insertion panel state
  showComponentPanel: boolean = false;
  
  // Actions dropdown menu state
  showActionsMenu: boolean = false;
  
  // Attachment state
  attachments: Attachment[] = [];
  private _navigatedAttachments: any[] = [];
  private _navigatedContext: string = '';
  
  // Diagram-as-Code state
  dacError: string = '';

  // Structured workspace state (from WorkspaceStateService)
  presentationMessages: ChatPresentationMessage[] = [];
  structuredOverview: OverviewModel | null = null;
  showFullPrompt: boolean = false;
  isImplementing: boolean = false;

  // Context-aware pipeline state
  architectureContext: any = null;
  principleEvaluation: any = null;
  deltaSummary: any = null;

  // WebSocket / streaming state
  wsConnectionState: WsConnectionState = 'disconnected';
  streamingStatus: string = '';
  isStreamingUpdate: boolean = false;
  workflowProgressPercent: number = 0;
  workflowProgressSteps: WorkflowProgressStep[] = [];
  workflowProgressTitle: string = 'Generating architecture';
  workflowProgressState: 'running' | 'needs_clarification' | 'completed' | 'failed' = 'running';
  /** True while a CHAT amendment (mutation/edit) is in flight — collapses the
   *  progress panel to just the active step instead of the full pipeline. */
  isMutationProgress = false;
  
  // Project persistence
  currentProjectId: string | null = null;
  lastSaveTimestamp: Date | null = null;
  autoSaveEnabled: boolean = true;

  private subscriptions: Subscription[] = [];
  private wsInitialized: boolean = false;

  // Export menu state (PR5).
  showExportMenu: boolean = false;
  isExporting: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private architectureService: ArchitectureService,
    private projectService: ProjectService,
    private workspaceStateService: WorkspaceStateService,
    private workflowJobService: WorkflowJobService,
    private wsService: WorkspaceWebSocketService,
    private attachmentService: AttachmentService,
    public fileUploadService: FileUploadService,
    private diagramExportService: DiagramExportService
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.prompt = navigation.extras.state['prompt'] || '';
      this.originalPrompt = this.prompt;
      this.workspaceId = navigation.extras.state['workspaceId'] || '';
      this.diagramType = navigation.extras.state['diagramType'] || null;
      this.preset = navigation.extras.state['preset'] || null;
      this.discoveryAnswers = navigation.extras.state['discoveryAnswers'] || [];
      this.discoveryConfidence = navigation.extras.state['discoveryConfidence'] || 0;
      this.resolvedSystemName = navigation.extras.state['discoveryAskSummary'] || '';
      this.pendingIntakeArtifactId = navigation.extras.state['intakeArtifactId'] || '';
      // showDiscovery no longer used — composition endpoint handles intake internally
      // and returns clarification_required when questions are needed

      // Extract attachments from generator navigation state
      const navAttachments = navigation.extras.state['attachments'];
      if (navAttachments && Array.isArray(navAttachments) && navAttachments.length > 0) {
        this._navigatedAttachments = navAttachments;
        console.log('[Workspace] Received', navAttachments.length, 'attachments from generator');
      }

      // Extract pre-built context from generator (includes attachment text)
      const navContext = navigation.extras.state['context'];
      if (navContext) {
        this._navigatedContext = navContext;
      }
      
      // Set canvas type based on diagram type
      if (this.diagramType) {
        this.canvasType = this.diagramType.canvasType;
      }
    }
    
    // Generate workspace ID
    if (!this.workspaceId) {
      this.workspaceId = this.generateWorkspaceId();
    }
  }

  get showStreamingStatusBubble(): boolean {
    return (this.isChatLoading || this.isStreamingUpdate)
      && !this.presentationMessages.some(msg => msg.metadata?.streaming);
  }

  get showWorkflowProgressPanel(): boolean {
    return this.isLoading || (this.isStreamingUpdate && this.workflowProgressSteps.length > 0);
  }

  /**
   * Steps to show in the progress panel. A full composition shows the whole
   * pipeline checklist; a CHAT AMENDMENT (mutation/edit) shows ONLY the step
   * currently in flight — the user asked for "just the new event in progress",
   * not a replay of the entire compose sequence.
   */
  get visibleProgressSteps(): WorkflowProgressStep[] {
    if (!this.isMutationProgress) return this.workflowProgressSteps;
    const active = this.workflowProgressSteps.filter(s => s.status === 'active');
    if (active.length) return active.slice(-1);
    return this.workflowProgressSteps.slice(-1);
  }

  private resetWorkflowProgress(title: string, message: string, minimal = false): void {
    this.workflowProgressTitle = title;
    this.workflowProgressPercent = 0;
    this.workflowProgressSteps = [];
    this.workflowProgressState = 'running';
    this.streamingStatus = message;
    this.isStreamingUpdate = true;
    // Minimal = a chat amendment: collapse the panel to the single active step.
    this.isMutationProgress = minimal;
  }

  private applyWorkflowEvent(event: WorkspaceJobEvent): void {
    this.streamingStatus = event.message || this.streamingStatus;
    if (typeof event.percent === 'number') {
      this.workflowProgressPercent = event.percent;
    }

    const nextStatus: 'active' | 'completed' | 'warning' = event.eventType === 'warning'
      ? 'warning'
      : (event.eventType === 'step_completed' || event.eventType === 'job_completed' ? 'completed' : 'active');

    const currentStage = event.stage || event.message || 'workflow';
    const existingIndex = this.workflowProgressSteps.findIndex(step => step.stage === currentStage);
    if (existingIndex >= 0) {
      this.workflowProgressSteps[existingIndex] = {
        ...this.workflowProgressSteps[existingIndex],
        message: event.message || this.workflowProgressSteps[existingIndex].message,
        status: nextStatus,
      };
    } else {
      this.workflowProgressSteps = [
        ...this.workflowProgressSteps,
        {
          stage: currentStage,
          message: event.message || currentStage,
          status: nextStatus,
        }
      ];
    }

    if (nextStatus === 'active') {
      this.workflowProgressSteps = this.workflowProgressSteps.map(step =>
        step.stage === currentStage || step.status === 'warning'
          ? step
          : { ...step, status: 'completed' }
      );
    }
  }

  private handleCompositionJobUpdate(update: WorkspaceJobUpdate<WorkspaceState>, request: WorkspaceGenerateRequest): void {
    if (update.event) {
      this.applyWorkflowEvent(update.event);
    }

    if (update.kind === 'clarification_required' && update.result) {
      this.workflowProgressState = 'needs_clarification';
      this.workspaceStateService.clearStreamingAssistantMessage();
      this.pendingIntakeArtifactId = update.result.intakeArtifactId || this.pendingIntakeArtifactId;
      this.preloadedIntakeQuestions = (update.result as any).clarificationQuestions || [];
      this.showDiscoveryDialog = this.preloadedIntakeQuestions.length > 0;
      this.isLoading = false;
      this.isChatLoading = false;
      this.isStreamingUpdate = false;
      this.streamingStatus = '';
      this.workflowProgressPercent = 100;
      return;
    }

    if (update.kind === 'completed' && update.result) {
      this.workflowProgressState = 'completed';
      this.workflowProgressPercent = 100;
      this.isStreamingUpdate = false;
      this.streamingStatus = '';
      this.pendingIntakeArtifactId = '';
      this.preloadedIntakeQuestions = [];
      this.workspaceStateService.applyCompositionState(update.result, request);
      this.handleStructuredState(update.result);
    }
  }

  private applyMutationResult(result: any): void {
    this.workspaceStateService.applyEditResult(result);

    // v2 chat-evolution: the BFF merged the delta into the existing
    // IntentGraph and recomposed via v2. Render the FULL evolved diagram on
    // the V2 canvas — keeping every existing node — instead of switching to
    // the legacy maxgraph canvas with a flat delta-only spec (the bug where
    // "add serverless for notification" replaced the whole diagram with 2
    // boxes).
    if (result.composeEngine === 'v2' && result.layoutIR) {
      this.canvasType = 'v2-maxgraph';
      this.layoutIR = result.layoutIR;
      // A chat-driven recompose supersedes manual canvas edits.
      this.canvasSnapshot = null;
      this.canvasDirty = false;
      this.diagramData = this.layoutIR;
      this.diagramId = result.diagramId || this.diagramId;
      if (result.userFacingSummary) {
        this.deltaSummary = result.userFacingSummary;
      }
      this.presentationMessages = this.workspaceStateService.chatMessages;
      this.saveProjectState();
      this.isChatLoading = false;
      this.shouldScrollToBottom = true;
      console.log('[Workspace] v2 mutation applied — diagram evolved, regions=',
                  (this.layoutIR?.regions || []).length);
      return;
    }

    if (result.intentType === 'architecture_edit' && result.updatedArchitectureModel) {
      const updatedModel = result.updatedArchitectureModel;
      if (updatedModel.canvasType === 'mermaid' && updatedModel.mermaidSource) {
        this.canvasType = 'mermaid';
        this.diagramData = updatedModel.mermaidSource;
        this.diagramCode = updatedModel.mermaidSource;
      } else {
        this.canvasType = 'maxgraph';
        this.diagramData = updatedModel;
        this.diagramData = { ...this.diagramData };
      }

      if (result.updatedOverview) {
        this.structuredOverview = result.updatedOverview;
      }
      if (result.updatedDiagramCode) {
        this.diagramCode = result.updatedDiagramCode;
      }

      const httpEditMsg = result.chatMessages?.find((m: any) => m.metadata?.deltaSummary);
      if (httpEditMsg?.metadata?.deltaSummary) {
        this.deltaSummary = httpEditMsg.metadata.deltaSummary;
      }
    }

    this.presentationMessages = this.workspaceStateService.chatMessages;
    this.saveProjectState();
    this.isChatLoading = false;
    this.shouldScrollToBottom = true;
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.workspaceStateService.state$.subscribe(state => {
        this.presentationMessages = this.workspaceStateService.normalizeChatPresentationMessages(state?.chatPresentationMessages || []);
      })
    );

    // Subscribe to attachment updates
    this.subscriptions.push(
      this.attachmentService.getAttachments().subscribe(attachments => {
        this.attachments = attachments;
      })
    );

    // Check if we're loading an existing project via query param
    this.route.queryParams.subscribe(params => {
      const projectId = params['projectId'];
      if (projectId) {
        console.log('[Workspace] Loading existing project:', projectId);
        this.loadExistingProject(projectId);
        return;
      }

      // Always proceed directly — composition endpoint handles intake internally.
      // If intake needs clarification, it returns clarification_required which
      // generateArchitecture() handles by showing the discovery dialog.

      // Display discovery answers in chat if available
      if (this.discoveryAnswers && this.discoveryAnswers.length > 0) {
        this.addDiscoveryAnswersToChat();
      }

      // If no prompt provided, show empty state
      if (!this.prompt || this.prompt.trim() === '') {
        console.log('[Workspace] No prompt provided');
        this.isLoading = false;
        this.errorMessage = 'No prompt provided. Please go back and enter your architecture requirements.';
      } else {
        this.generateArchitecture();
      }
    });
  }

  /**
   * Load existing project data from backend
   */
  private loadExistingProject(projectId: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Fetch project details
    this.projectService.getProject(projectId).subscribe({
      next: (project) => {
        console.log('[Workspace] Loaded project:', project);
        this.diagramName = project.name;
        this.resolvedSystemName = project.metadata?.resolvedSystemName || project.name || this.resolvedSystemName;
        this.prompt = project.description || project.name;
        this.workspaceId = projectId;
        this.currentProjectId = projectId; // SET PROJECT ID FOR AUTO-SAVE
        
        // Check if project has diagram data in metadata
        if (project.metadata?.diagramSpec) {
          this.diagramData = project.metadata.diagramSpec;
          this.canvasType = project.metadata.canvasType || 'maxgraph';
          // Restore the v2 render inputs so the editable canvas comes back with
          // both the composed structure AND any saved manual edits.
          if (this.canvasType === 'v2-maxgraph') {
            this.layoutIR = project.metadata.layoutIR || project.metadata.diagramSpec;
            this.canvasSnapshot = project.metadata.canvasSnapshot || null;
          }
          console.log('[Workspace] Restored diagram from project metadata');
        }
        
        // Check if project has conversation history in metadata
        if (project.metadata?.chatMessages && Array.isArray(project.metadata.chatMessages)) {
          this.chatMessages = project.metadata.chatMessages.map((msg: any) => ({
            text: msg.text,
            isUser: msg.isUser,
            timestamp: new Date(msg.timestamp),
            isLoading: false,
            isDiscovery: msg.isDiscovery || false
          }));
          console.log('[Workspace] Restored', this.chatMessages.length, 'chat messages');
        }
        
        // If no diagram found, show message
        if (!this.diagramData) {
          console.log('[Workspace] No diagram in project');
          this.isLoading = false;
          this.errorMessage = 'No diagram found in this project. Use the chat or regenerate.';
        } else {
          this.isLoading = false;
        }

        // Initialize WebSocket for existing project
        this.initWebSocket();
      },
      error: (err) => {
        console.error('[Workspace] Failed to load project:', err);
        this.errorMessage = 'Failed to load project. Backend service may be unavailable.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Add discovery Q&A as structured clarification chips (not raw text dump).
   * This is only used when the workspace was navigated to with pre-existing answers
   * before the structured API is called.
   */
  private addDiscoveryAnswersToChat(): void {
    // No-op: structured API handles clarification display via presentation messages.
    // Legacy chatMessages are no longer used for clarification display.
  }

  /**
   * Initialize WebSocket connection and subscribe to all workspace events.
   */
  private initWebSocket(): void {
    console.log('[Workspace] Initializing WebSocket for workspace:', this.workspaceId);
    this.wsService.connect(this.workspaceId);

    if (this.wsInitialized) {
      return;
    }
    this.wsInitialized = true;

    // Connection state
    this.subscriptions.push(
      this.wsService.connectionState$.subscribe(state => {
        this.wsConnectionState = state;
        console.log('[Workspace] WS connection state:', state);
      })
    );

    // Agent thinking / status updates
    this.subscriptions.push(
      this.wsService.agentThinking$.subscribe(event => {
        this.streamingStatus = event['status'] || 'Thinking…';
        this.isStreamingUpdate = true;
        this.shouldScrollToBottom = true;
      })
    );

    // Architecture update started
    this.subscriptions.push(
      this.wsService.architectureUpdateStarted$.subscribe(event => {
        this.streamingStatus = event['status'] || 'Updating architecture…';
        this.isStreamingUpdate = true;
        this.shouldScrollToBottom = true;
      })
    );

    // Message stream (incremental assistant content)
    this.subscriptions.push(
      this.wsService.messageStream$.subscribe(event => {
        this.streamingStatus = '';
        this.isStreamingUpdate = false;
        this.workspaceStateService.upsertStreamingAssistantMessage(event['content'] || '');
        this.presentationMessages = this.workspaceStateService.chatMessages;
        this.shouldScrollToBottom = true;
      })
    );

    // Diagram regenerated
    this.subscriptions.push(
      this.wsService.diagramRegenerated$.subscribe(() => {
        this.streamingStatus = 'Diagram updated';
      })
    );

    // Overview regenerated
    this.subscriptions.push(
      this.wsService.overviewRegenerated$.subscribe(() => {
        this.streamingStatus = 'Overview refreshed';
      })
    );

    // Code regenerated
    this.subscriptions.push(
      this.wsService.codeRegenerated$.subscribe(() => {
        this.streamingStatus = 'Code refreshed';
      })
    );

    // Architecture update completed — apply all artifacts
    this.subscriptions.push(
      this.wsService.architectureUpdateCompleted$.subscribe((result: WsEditResult) => {
        console.log('[Workspace] WS architecture update completed:', result.intentType);
        this.streamingStatus = '';
        this.isStreamingUpdate = false;
        this.isChatLoading = false;

        if (result.chatMessages?.length) {
          this.workspaceStateService.appendChatMessages(result.chatMessages as ChatPresentationMessage[]);
        }
        const completionContent = (result.userFacingSummary || (result as any).content || '').trim();
        if (completionContent
          && !result.chatMessages?.some((msg: any) => msg.type === 'assistant'
            && typeof msg.content === 'string'
            && msg.content.trim() === completionContent)) {
          this.workspaceStateService.finalizeStreamingAssistantMessage(completionContent);
        } else {
          this.workspaceStateService.clearStreamingAssistantMessage();
        }

        // v2 chat-evolution over WebSocket — same as the HTTP path: render
        // the full recomposed diagram on the V2 canvas, preserving every
        // existing node, instead of switching to the legacy canvas.
        if ((result as any).composeEngine === 'v2' && (result as any).layoutIR) {
          this.canvasType = 'v2-maxgraph';
          this.layoutIR = (result as any).layoutIR;
          this.diagramData = this.layoutIR;
          this.diagramId = (result as any).diagramId || this.diagramId;
          if (result.userFacingSummary) {
            this.deltaSummary = result.userFacingSummary as any;
          }
          this.presentationMessages = this.workspaceStateService.chatMessages;
          this.saveProjectState();
          this.shouldScrollToBottom = true;
          return;
        }

        if ((result as any).workspaceId && (result as any).architectureModel) {
          this.handleStructuredState(result as unknown as WorkspaceState);
          return;
        }

        if (result.intentType === 'architecture_edit' && result.updatedArchitectureModel) {
          // Update diagram — detect mermaid vs maxGraph
          const updatedModel = result.updatedArchitectureModel;
          if (updatedModel.canvasType === 'mermaid' && updatedModel.mermaidSource) {
            this.canvasType = 'mermaid';
            this.diagramData = updatedModel.mermaidSource;
            this.diagramCode = updatedModel.mermaidSource;
          } else {
            this.canvasType = 'maxgraph';
            this.diagramData = updatedModel;
            this.diagramData = { ...this.diagramData }; // trigger change detection
          }

          // Update overview
          if (result.updatedOverview) {
            this.structuredOverview = result.updatedOverview;
          }

          // Update DAC code
          if (result.updatedDiagramCode) {
            this.diagramCode = result.updatedDiagramCode;
          }

          // Update delta from edit response chat metadata
          const editMsg = result.chatMessages?.find((m: any) => m.metadata?.deltaSummary);
          if (editMsg?.metadata?.deltaSummary) {
            this.deltaSummary = editMsg.metadata.deltaSummary;
          }

          // Update state service
          this.workspaceStateService.updateArchitectureModel(this.diagramData);
          if (result.updatedDiagramCode) {
            this.workspaceStateService.updateDiagramCode(result.updatedDiagramCode);
          }
        }

        this.presentationMessages = this.workspaceStateService.chatMessages;
        this.saveProjectState();
        this.shouldScrollToBottom = true;
      })
    );

    // Errors
    this.subscriptions.push(
      this.wsService.errors$.subscribe(event => {
        console.error('[Workspace] WS error:', event['message']);
        this.streamingStatus = '';
        this.isStreamingUpdate = false;
        this.isChatLoading = false;
        this.workspaceStateService.clearStreamingAssistantMessage();
        this.workspaceStateService.addChatMessage('assistant', event['message'] || 'Live update failed.');
        this.presentationMessages = this.workspaceStateService.chatMessages;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.wsService.disconnect();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    if (this.chatContainer?.nativeElement) {
      const el = this.chatContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  /**
   * Generate architecture via structured workspace-architect API
   */
  private generateArchitecture(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.taskProgress = 0;

    console.log('[Workspace] Starting structured architecture generation for prompt:', this.prompt.substring(0, 50));

    // Convert discoveryAnswers to structured ClarificationAnswer[] for new API
    const structuredAnswers: StructuredClarificationAnswer[] = this.discoveryAnswers.map(a => ({
      questionId: a.questionId || a.question.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30),
      question: a.question,
      answer: a.answer,
      // dimension is propagated from intake → composition so the
      // synthesize_context task can index answers by dimension without
      // re-parsing the question text. Optional — empty when intake
      // didn't tag the source question (legacy / agent didn't emit).
      dimension: (a as any)?.dimension || '',
    }));
    const shouldResumeIntakeWithClarifications = this.preloadedIntakeQuestions.length > 0;
    const clarificationAnswersForComposition = shouldResumeIntakeWithClarifications && structuredAnswers.length > 0
      ? structuredAnswers
      : undefined;

    const currentDiagramType = this.diagramType?.value || 'deployment-infrastructure';
    const resolvedProvider = this.resolveCloudProvider(currentDiagramType, structuredAnswers, this.prompt);

    this.workspaceStateService.ensureWorkspaceState({
      workspaceId: this.workspaceId,
      prompt: this.prompt,
      diagramType: currentDiagramType,
      cloudProvider: resolvedProvider,
      intakeArtifactId: this.pendingIntakeArtifactId || undefined,
      clarificationAnswers: clarificationAnswersForComposition,
      resolvedSystemName: this.resolvedSystemName || undefined,
    });

    // Capture attachments: prefer workspace attachment context, fall back to navigated attachments from generator
    const attachmentCtx = this.getAttachmentContext();
    let attachedDocs: any[] | undefined;
    if (attachmentCtx?.hasAttachments) {
      attachedDocs = attachmentCtx.attachments.map((a: any) => ({
        id: a.id || a.name,
        type: a.type || 'document',
        filename: a.name,
        mimeType: a.mimeType || '',
        summary: a.summary || '',
        extractedText: a.extractedText || '',
      }));
    } else if (this._navigatedAttachments.length > 0) {
      attachedDocs = this._navigatedAttachments.map((f: any) => ({
        id: f.id || f.name || f.filename,
        type: f.type || 'document',
        filename: f.name || f.filename || '',
        mimeType: f.mimeType || f.file?.type || '',
        summary: f.summary || '',
        extractedText: f.extractedText || f.content || '',
      }));
    }

    if (attachedDocs?.length) {
      console.log('[Workspace] Including', attachedDocs.length, 'attachments in composition request');
    }

    // ── Guard: intakeArtifactId must be present (from analyze→clarify flow) ──
    if (!this.pendingIntakeArtifactId) {
      console.log('[Workspace] No intakeArtifactId — opening discovery dialog first');
      this.isLoading = false;
      this.showDiscoveryDialog = true;
      return;
    }

    const handoffName = this.resolvedSystemName.trim();
    if (handoffName) {
      this.workspaceStateService.addChatMessage(
        'assistant',
        `Understood your request for ${handoffName}. Starting composition.`,
        { phase: 'composition_start', resolvedSystemName: handoffName }
      );
    } else {
      this.workspaceStateService.addChatMessage(
        'assistant',
        'Understood your request. Starting composition.',
        { phase: 'composition_start' }
      );
    }
    this.presentationMessages = this.workspaceStateService.chatMessages;
    this.shouldScrollToBottom = true;

    const compositionRequest: WorkspaceGenerateRequest = {
      prompt: this.prompt,
      workspaceId: this.workspaceId,
      intakeArtifactId: this.pendingIntakeArtifactId,
      diagramType: this.diagramType?.value || 'deployment-infrastructure',
      preset: this.preset || undefined,
      cloudProvider: resolvedProvider,
      clarificationAnswers: clarificationAnswersForComposition,
      attachedDocuments: attachedDocs,
    };

    this.resetWorkflowProgress('Generating architecture', 'Understanding requirements…');
    this.workspaceStateService.clearStreamingAssistantMessage();
    this.shouldScrollToBottom = true;
    const sub = this.workflowJobService.runJob<WorkspaceState>('/api/v1/workspace-architect/jobs/composition', compositionRequest).subscribe({
      next: update => this.handleCompositionJobUpdate(update, compositionRequest),
      error: (error: any) => {
        const detail = error?.error?.message || error?.error?.detail || error?.error?.error
          || error?.message || error?.statusText || 'Unknown error';
        // workflowJobService attaches structured details on job_failed —
        // surface IntentGraph validation findings in the banner so the
        // user sees actionable codes (NODE_NOT_IN_RESOURCE_GROUP,
        // ORPHAN_BOUNDARY_PARENT, etc.) instead of just "Generation failed".
        const details = error?.details || {};
        const findings: Array<{code: string; severity: string; entityId?: string; message: string}> =
            Array.isArray(details.findings) ? details.findings : [];
        console.error('[Workspace] Structured generation failed:', detail,
            findings.length ? `(${findings.length} finding(s))` : '', error);
        this.workflowProgressState = 'failed';
        this.workspaceStateService.clearStreamingAssistantMessage();
        let banner = `Architecture generation failed: ${detail}`;
        if (findings.length > 0) {
          const errs = findings.filter(f => f.severity === 'ERROR');
          const worth = (errs.length ? errs : findings).slice(0, 5);
          banner += '\n\n' + worth.map(f =>
            `• ${f.code}${f.entityId ? ` (${f.entityId})` : ''} — ${f.message}`
          ).join('\n');
          if (findings.length > worth.length) {
            banner += `\n…and ${findings.length - worth.length} more.`;
          }
        }
        this.handleGenerationError(banner);
      },
      complete: () => {
        console.log('[Workspace] Generation subscription completed');
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Handle structured workspace state from the new API
   */
  /**
   * Deterministic intent classifier — detects when a chat message is
   * asking for an architecture explanation vs requesting an edit. Cheap
   * keyword heuristic catches ~90% of cases; can be upgraded to a Haiku
   * classifier in Phase 1 for ambiguous prompts. Avoids running a full
   * mutation crew (~$0.05) when a cached overview ($0) would answer the
   * question.
   */
  private isOverviewIntent(msg: string): boolean {
    if (!msg) return false;
    const t = msg.trim().toLowerCase();
    if (t.length < 3) return false;
    const cues = [
      'explain', 'overview', 'summarize', 'summarise', 'summary',
      'walk me through', 'walk through', 'what does this', 'what is this',
      'tell me about', 'describe', 'rationale', 'why ', 'principles',
      'tradeoff', 'trade-off', 'trade off', 'patterns used',
      'key components', 'architecture overview',
    ];
    return cues.some(cue => t.includes(cue));
  }

  /**
   * Route a chat-driven "explain" intent through the lazy overview
   * endpoint and echo the executiveSummary back into the chat thread as
   * the assistant reply.
   */
  private handleOverviewChatMessage(userMessage: string, resolvedProvider: string): void {
    this.isChatLoading = true;
    this.workspaceStateService.clearStreamingAssistantMessage();
    this.architectureService.fetchOverview(this.workspaceId, this.diagramId!, {
      prompt: this.prompt,
      cloudProvider: (resolvedProvider || 'aws').toLowerCase(),
      version: this.layoutIR?.version ?? 'v0',
    }).subscribe({
      next: payload => {
        this.overviewPayload = payload;
        if (payload && !payload.error) this.structuredOverview = payload;
        const reply = this.formatOverviewForChat(payload);
        this.workspaceStateService.addChatMessage('assistant', reply, {
          phase: 'overview',
          source: payload?.source || 'agent',
          intent: 'explain',
        });
        this.presentationMessages = this.workspaceStateService.chatMessages;
        this.shouldScrollToBottom = true;
        this.isChatLoading = false;
      },
      error: err => {
        const detail = err?.error?.detail || err?.message || 'unknown error';
        this.workspaceStateService.addChatMessage('assistant',
            `Couldn't generate the overview — ${detail}. Try the "Explain this architecture" button below the canvas.`,
            { phase: 'overview', error: true });
        this.presentationMessages = this.workspaceStateService.chatMessages;
        this.shouldScrollToBottom = true;
        this.isChatLoading = false;
      },
    });
  }

  /**
   * Render the structured OverviewOutput into a chat-friendly markdown
   * string. Mirrors the structure of the side panel so the user sees the
   * same information whether they click the button or ask in chat.
   */
  private formatOverviewForChat(p: any): string {
    if (!p || p.error) return 'No overview available right now.';
    const lines: string[] = [];
    if (p.executiveSummary) lines.push(p.executiveSummary);
    if (p.patterns?.length) {
      lines.push('', '**Patterns applied**');
      for (const x of p.patterns) {
        lines.push(`- **${x.name}**${x.rationale ? ` — ${x.rationale}` : ''}`);
      }
    }
    if (p.principles?.length) {
      lines.push('', '**Principles**');
      for (const x of p.principles) {
        lines.push(`- **${x.name}**${x.evidence ? ` — ${x.evidence}` : ''}`);
      }
    }
    if (p.considerations?.length) {
      lines.push('', '**Trade-offs**');
      for (const x of p.considerations) {
        const t = x.topic || x.title || '';
        const d = x.tradeoff || x.note || '';
        lines.push(`- ${t}${d ? ` — ${d}` : ''}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Fire the lazy overview narrator. Triggered by the "Explain this
   * architecture" button below the v2 canvas. Server caches by version,
   * so repeated clicks within a compose are instant.
   */
  loadOverview(): void {
    if (!this.diagramId || !this.workspaceId) {
      this.overviewError = 'No diagram loaded yet';
      return;
    }
    if (this.overviewLoading) return;
    this.overviewLoading = true;
    this.overviewError = null;
    const body = {
      prompt: this.prompt,
      cloudProvider: (this.resolveCloudProvider(
          this.diagramType?.value || 'deployment-infrastructure',
          [] as StructuredClarificationAnswer[],
          this.prompt) || 'aws').toLowerCase(),
      version: this.layoutIR?.version ?? 'v0',
    };
    this.architectureService.fetchOverview(this.workspaceId, this.diagramId, body).subscribe({
      next: payload => {
        this.overviewPayload = payload;
        this.overviewLoading = false;
        // Promote into the structured overview slot the Overview tab renders.
        // Mark the version as loaded so re-opening the tab doesn't refetch
        // (until the diagram is regenerated to a new version).
        if (payload && !payload.error) {
          this.structuredOverview = payload;
          this.overviewLoadedVersion = body.version;
        }
      },
      error: err => {
        const detail = err?.error?.detail || err?.error?.error || err?.message || 'Unknown error';
        this.overviewError = `Overview generation failed: ${detail}`;
        this.overviewLoading = false;
        console.error('[Workspace] loadOverview failed:', err);
      },
    });
  }

  /**
   * Return a trimmed title, or '' if the candidate is blank or the generic
   * placeholder "Architecture" (which must never win over a real name).
   */
  private cleanTitle(candidate: string | null | undefined): string {
    const t = (candidate || '').trim();
    if (!t) return '';
    return t.toLowerCase() === 'architecture' ? '' : t;
  }

  /**
   * Last-resort title: derive a short, readable name from the user's prompt
   * when no system name is available. Strips leading verbs ("design",
   * "create", "build", "generate", "show me") and trailing cloud noise,
   * then Title-Cases the first few words. Returns '' when the prompt is
   * empty so the caller can fall through to a generic label.
   */
  private deriveTitleFromPrompt(): string {
    let p = (this.prompt || '').trim();
    if (!p) return '';
    p = p.replace(/^(please\s+)?(design|create|build|generate|draw|show me|make|produce|architect)\s+(a|an|the)?\s*/i, '');
    p = p.replace(/\b(architecture|diagram|on aws|on azure|on gcp|deployment|infrastructure)\b.*$/i, '').trim();
    const words = p.split(/\s+/).filter(Boolean).slice(0, 6);
    if (words.length === 0) return '';
    const title = words
        .map(w => w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
        .join(' ')
        .replace(/[.,;:]+$/, '')
        .trim();
    return title.length >= 3 ? title : '';
  }

  private handleStructuredState(state: WorkspaceState): void {
    // Don't let a blank/generic backend value clobber the user's confirmed
    // system name from intake. The composition assembler now sends "" when
    // it has no real name (it previously sent the literal "Architecture",
    // which overwrote the good local value — that's why every diagram title
    // read "Architecture" regardless of the project).
    const incomingSystemName = (state.resolvedSystemName || '').trim();
    if (incomingSystemName && incomingSystemName.toLowerCase() !== 'architecture') {
      this.resolvedSystemName = incomingSystemName;
    }

    // Update diagram — three render paths in priority order:
    //   1) v2 LayoutIR (composeEngine === "v2") → V2MaxGraphCanvas
    //   2) mermaidSource → MermaidCanvas (legacy)
    //   3) DiagramSpec → MaxGraphCanvas (legacy v1)
    // The BFF orchestrator routes every composition through v2 in Phase 0
    // cutover; greenfield/mutation flows that haven't been cut over yet
    // still emit a DiagramSpec and fall back to the legacy MaxGraph path.
    const isV2 = state.composeEngine === 'v2' && !!(state as any).layoutIR;
    if (isV2) {
      this.canvasType = 'v2-maxgraph';
      this.layoutIR = (state as any).layoutIR;
      // A fresh compose/regenerate supersedes any manual canvas edits.
      this.canvasSnapshot = null;
      this.canvasDirty = false;
      this.diagramData = this.layoutIR; // keep diagramData populated for legacy chat handlers
      this.diagramId = (state as any).diagramId || this.layoutIR?.diagramId || null;
      this.diagramName = this.cleanTitle(this.layoutIR?.meta?.diagramTitle)
          || this.cleanTitle(this.resolvedSystemName)
          || this.deriveTitleFromPrompt()
          || `Generated ${this.diagramType?.label || 'Architecture'}`;
      console.log('[Workspace] v2 LayoutIR loaded — pattern=', (state as any).patternId,
                  'regions=', (this.layoutIR?.regions || []).length);
    } else if (state.architectureModel) {
      const model = state.architectureModel;
      if (model.canvasType === 'mermaid' && model.mermaidSource) {
        this.canvasType = 'mermaid';
        this.diagramData = model.mermaidSource;
        this.diagramCode = model.mermaidSource;
        this.diagramName = model.title || this.resolvedSystemName || `Generated ${this.diagramType?.label || 'Architecture'}`;
        console.log('[Workspace] Mermaid view:', model.diagramType);
      } else {
        this.canvasType = 'maxgraph';
        this.diagramData = model;
        this.diagramName = model.title || this.resolvedSystemName || `Generated ${this.diagramType?.label || 'Cloud Architecture'}`;
        console.log('[Workspace] legacy maxGraph view:', model.diagramType);
      }
    }

    // Update DAC code
    if (state.diagramCode) {
      this.diagramCode = state.diagramCode;
    }

    // Update structured overview
    this.structuredOverview = state.overview || null;

    // Update context-aware pipeline data
    this.architectureContext = (state as any).architectureContext || null;
    this.principleEvaluation = (state as any).principleEvaluation || null;
    this.deltaSummary = (state as any).deltaSummary || null;

    // Update presentation messages (chat) — render the FULL accumulated
    // thread, not just this composition state's messages. Replacing the
    // thread with the backend's minimal [request_summary] erased the
    // original prompt + clarification Q&A the moment compose finished
    // (user feedback: "the initial prompt disappeared"). Merge any messages
    // carried on this state into the service thread (idempotent — the main
    // composition path already merged via applyCompositionState; the edit /
    // chat paths that also call this method have not), then render the
    // accumulated thread so the conversation reads prompt → Q&A → result,
    // Claude-style.
    if (state.chatPresentationMessages?.length) {
      this.workspaceStateService.appendChatMessages(state.chatPresentationMessages);
    }
    this.presentationMessages = this.workspaceStateService.chatMessages;

    // Track diagramType and canvasType in workspace state for follow-up edits
    this.workspaceStateService.setDiagramType(
      this.diagramType?.value || state.architectureRequest?.diagramType || 'deployment-infrastructure',
      this.canvasType
    );

    // Persist project
    this._persistProject(this.diagramName);

    // Initialize WebSocket session after generation completes
    if (this.wsConnectionState === 'disconnected') {
      this.initWebSocket();
    }

    this.isLoading = false;
    this.isStreamingUpdate = false;
    this.isChatLoading = false;
    this.streamingStatus = '';
    this.shouldScrollToBottom = true;
  }

  /**
   * Handle successful diagram generation
   */
  private handleGenerationComplete(result: any): void {
    if (result.diagramData) {
      // Check if this is a cloud architecture with DiagramSpec
      if (result.diagramData.spec) {
        // Cloud architecture with DiagramSpec JSON (for maxGraph rendering)
        this.canvasType = 'maxgraph';
        this.diagramData = result.diagramData.spec;
        this.diagramName = `Generated ${this.diagramType?.label || 'Cloud Architecture'}`;
        console.log('[Workspace] Loaded cloud architecture DiagramSpec:', this.diagramData);
        
        // Persist project
        this._persistProject(this.diagramName);
        
        // Convert to DAC code instead of JSON
        this.architectureService.reverseDiagramToCode(this.diagramData).subscribe({
          next: (dacResult) => {
            this.diagramCode = dacResult.code;
          },
          error: () => {
            // Fallback to empty if reverse fails
            this.diagramCode = '';
          }
        });
        
        // Check for openQuestions and add them to chat
        if (this.diagramData.openQuestions && this.diagramData.openQuestions.length > 0) {
          this.addClarificationQuestionsToChat(this.diagramData.openQuestions);
        }
      } else if (result.diagramData.code) {
        // Update canvas type based on result
        if (result.diagramData.type === 'mermaid') {
          // Mermaid diagrams use code as-is
          this.canvasType = 'mermaid';
          this.diagramData = result.diagramData.code;
          this.diagramCode = result.diagramData.code;
        } else {
          // maxgraph diagrams - parse DiagramSpec JSON
          this.canvasType = 'maxgraph';
          try {
            // Parse DiagramSpec JSON if it's a string
            this.diagramData = typeof result.diagramData.code === 'string' 
              ? JSON.parse(result.diagramData.code) 
              : result.diagramData.code;
            this.diagramCode = typeof result.diagramData.code === 'string'
              ? result.diagramData.code
              : JSON.stringify(this.diagramData, null, 2);
            console.log('[Workspace] Loaded mxGraph DiagramSpec:', this.diagramData);
          } catch (e) {
            console.error('[Workspace] Failed to parse DiagramSpec JSON:', e);
            this.diagramData = result.diagramData.code;
            this.diagramCode = JSON.stringify(result.diagramData.code, null, 2);
          }
        }
        this.diagramName = `Generated ${this.diagramType?.label || 'Architecture'}`;
        this._persistProject(this.diagramName);
      }
      
      // Extract architecture overview if available
      if (result.description) {
        this.architectureOverview = result.description;
      } else {
        this.architectureOverview = this.generateDefaultOverview();
      }
    }
    this.isLoading = false;
  }

  /**
   * Create or update project with current state (diagram + conversation)
   */
  private saveProjectState(): void {
    if (!this.autoSaveEnabled) return;

    const projectName = this.diagramName || this.resolvedSystemName || this.prompt?.substring(0, 60) || 'Untitled Architecture';
    const metadata = {
      diagramSpec: this.diagramData,
      canvasType: this.canvasType,
      // v2 fields so a reloaded project restores the diagram + manual edits.
      layoutIR: this.layoutIR,
      canvasSnapshot: this.canvasSnapshot,
      chatMessages: this.chatMessages.map(msg => ({
        text: msg.text,
        isUser: msg.isUser,
        timestamp: msg.timestamp.toISOString(),
        isDiscovery: msg.isDiscovery || false
      })),
      prompt: this.prompt,
      resolvedSystemName: this.resolvedSystemName,
      diagramType: this.diagramType?.value,
      lastModified: new Date().toISOString()
    };

    if (this.currentProjectId) {
      // Update existing project with metadata
      this.projectService.updateProject(this.currentProjectId, {
        name: projectName,
        description: this.prompt || '',
        tags: [this.diagramType?.value || 'cloud-architecture'],
        metadata: metadata
      }).subscribe({
        next: () => {
          this.lastSaveTimestamp = new Date();
          console.log('[Workspace] Project updated:', this.currentProjectId);
        },
        error: (err) => console.warn('[Workspace] Failed to update project:', err)
      });
    } else {
      // Create new project with metadata
      this.projectService.createProject({
        name: projectName,
        description: this.prompt || '',
        tags: [this.diagramType?.value || 'cloud-architecture'],
        metadata: metadata
      }).subscribe({
        next: (project) => {
          this.currentProjectId = project.id;
          this.workspaceId = project.id;
          this.lastSaveTimestamp = new Date();
          console.log('[Workspace] Project created:', project.id);
        },
        error: (err) => console.warn('[Workspace] Failed to create project:', err)
      });
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  private _persistProject(name: string): void {
    this.diagramName = name;
    this.saveProjectState();
  }

  private generateDefaultOverview(): string {
    const type = this.diagramType?.label || 'Architecture';
    return `# ${type} Overview\n\nA scalable architecture designed with best practices.\n\n## Key Components\n\n${this.diagramData?.nodes?.map((n: any) => `- **${n.label || n.id}**: ${n.type || 'Component'}`).join('\n') || 'Components are being analyzed...'}`;
  }

  /**
   * Add clarification questions to interactive UI
   */
  private addClarificationQuestionsToChat(questions: string[]): void {
    this.clarificationQuestions = questions;
    this.showClarificationQuestions = true;
    
    console.log('[Workspace] Displaying interactive clarification questions:', questions);
  }
  
  /**
   * Handle clarification answers submission
   */
  handleClarificationAnswers(answers: Map<string, string>): void {
    const message = answers.get('message');
    if (message) {
      // Hide clarification UI
      this.showClarificationQuestions = false;
      
      // Send answers as chat message
      this.chatInput = message;
      this.sendMessage();
    }
  }

  /**
   * Toggle component insertion panel
   */
  toggleComponentPanel(): void {
    this.showComponentPanel = !this.showComponentPanel;
  }

  /**
   * Toggle actions dropdown menu
   */
  toggleActionsMenu(): void {
    this.showActionsMenu = !this.showActionsMenu;
  }

  /**
   * Close dropdowns when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.showActionsMenu = false;
    }
  }

  /**
   * Generate Solution Blueprint - navigates to blueprint module with project data
   */
  generateSolutionBlueprint(): void {
    this.showActionsMenu = false;
    
    // Save current state before navigating
    this.saveProjectState();
    
    // Navigate to solution blueprint module with project context
    if (this.currentProjectId) {
      this.router.navigate(['/solution-blueprint'], {
        queryParams: { projectId: this.currentProjectId }
      });
    } else {
      alert('Please save the project first by generating a diagram.');
    }
  }

  /**
   * Generate HLD - navigates to HLD generation module
   */
  generateHLD(): void {
    this.showActionsMenu = false;
    
    // Save current state before navigating
    this.saveProjectState();
    
    // Navigate to HLD module with project context
    if (this.currentProjectId) {
      // TODO: Update route when HLD module is implemented
      this.router.navigate(['/artifact-hub'], {
        queryParams: { 
          projectId: this.currentProjectId,
          artifactType: 'hld'
        }
      });
    } else {
      alert('Please save the project first by generating a diagram.');
    }
  }

  /**
   * Run Assessment - navigates to architecture assessment module
   */
  runAssessment(): void {
    this.showActionsMenu = false;
    
    // Save current state before navigating
    this.saveProjectState();
    
    // Navigate to assessment module with project context
    if (this.currentProjectId) {
      this.router.navigate(['/architecture-assessment'], {
        queryParams: { projectId: this.currentProjectId }
      });
    } else {
      alert('Please save the project first by generating a diagram.');
    }
  }

  /**
   * Handle component selected from panel — insert directly onto canvas
   */
  handleComponentSelected(item: any): void {
    console.log('[Workspace] Component selected:', item);
    if (this.canvasType === 'v2-maxgraph' && this.v2canvas) {
      // Click-to-insert onto the editable v2 canvas (drag-drop also works).
      this.v2canvas.insertComponent(item);
    } else if (this.canvasType === 'maxgraph' && this.maxgraphCanvas) {
      this.maxgraphCanvas.insertComponent(item);
    } else {
      // Fallback: send as chat command
      this.chatInput = `Add ${item.name} to the architecture`;
      this.sendMessage();
    }
  }

  /** v2 canvas reported a manual edit (move / insert / relabel / connect). */
  onCanvasDirty(dirty: boolean): void {
    this.canvasDirty = dirty;
  }

  /**
   * Sync button — persist the v2 canvas's manual edits to the BFF in ONE call
   * (a flat snapshot saved into the project), instead of a roundtrip per drag.
   * On reload the snapshot is replayed so edits survive.
   */
  syncCanvas(): void {
    if (!this.v2canvas || this.canvasSyncing) return;
    this.canvasSyncing = true;
    try {
      const snap = this.v2canvas.getSnapshot();
      this.canvasSnapshot = snap;
      // saveProjectState() persists project.metadata (one BFF call via
      // projectService.updateProject) — see metadata.canvasSnapshot below.
      this.saveProjectState();
      this.canvasDirty = false;
      this.workspaceStateService.addChatMessage('assistant',
        `Saved your canvas edits (${snap.nodes?.length || 0} components, ${snap.edges?.length || 0} connections).`);
      this.presentationMessages = this.workspaceStateService.chatMessages;
    } catch (e) {
      console.error('[Workspace] Canvas sync failed:', e);
    } finally {
      this.canvasSyncing = false;
    }
  }

  /**
   * Persist live maxGraph edits without forcing a full canvas rerender.
   */
  handleDiagramChanged(updatedDiagram: any): void {
    if (this.canvasType !== 'maxgraph' || !updatedDiagram) {
      return;
    }

    if (this.diagramData && typeof this.diagramData === 'object') {
      Object.assign(this.diagramData, updatedDiagram);
    } else {
      this.diagramData = updatedDiagram;
    }

    this.workspaceStateService.updateArchitectureModel(this.diagramData);
  }

  /**
   * Undo last canvas action
   */
  undoCanvas(): void {
    if (this.canvasType === 'maxgraph' && this.maxgraphCanvas) {
      this.maxgraphCanvas.undo();
    }
  }

  /**
   * Redo last undone canvas action
   */
  redoCanvas(): void {
    if (this.canvasType === 'maxgraph' && this.maxgraphCanvas) {
      this.maxgraphCanvas.redo();
    }
  }

  /**
   * Render diagram from Diagram-as-Code text
   */
  renderFromCode(): void {
    if (!this.diagramCode?.trim()) {
      this.dacError = 'Please enter diagram code first';
      return;
    }
    this.dacError = '';
    this.isLoading = true;

    this.architectureService.parseDiagramAsCode(this.diagramCode).subscribe({
      next: (result) => {
        console.log('[Workspace] DAC parsed:', result);
        this.diagramData = result.diagramSpec;
        this.canvasType = 'maxgraph';
        this.diagramName = result.diagramSpec?.title || 'Diagram from Code';
        this.isLoading = false;
      },
      error: (err) => {
        console.error('[Workspace] DAC parse error:', err);
        this.dacError = 'Failed to parse diagram code: ' + (err.error?.detail || err.message);
        this.isLoading = false;
      }
    });
  }

  /**
   * Generate Diagram-as-Code text from current diagram
   */
  reverseToCode(): void {
    if (!this.diagramData) {
      this.dacError = 'No diagram to convert';
      return;
    }
    this.dacError = '';

    this.architectureService.reverseDiagramToCode(this.diagramData).subscribe({
      next: (result) => {
        this.diagramCode = result.code;
      },
      error: (err) => {
        console.error('[Workspace] DAC reverse error:', err);
        this.dacError = 'Failed to generate code: ' + (err.error?.detail || err.message);
      }
    });
  }

  /**
   * Handle generation error — show error to user, no fallbacks
   */
  private handleGenerationError(error: string): void {
    this.errorMessage = error;
    this.isLoading = false;
    this.isStreamingUpdate = false;
    this.isChatLoading = false;
    this.streamingStatus = '';
  }

  private inferCloudProviderFromText(text: string): string | undefined {
    const normalized = (text || '').toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (normalized.includes('multi-cloud') || normalized.includes('multicloud') || normalized.includes('multi cloud')) {
      return 'multi-cloud';
    }
    if (normalized.includes('hybrid') || normalized.includes('on-prem') || normalized.includes('on premises') || normalized.includes('data center')) {
      return 'hybrid';
    }
    if (normalized.includes('aws') || normalized.includes('amazon web services')) {
      return 'aws';
    }
    if (normalized.includes('azure')) {
      return 'azure';
    }
    if (normalized.includes('gcp') || normalized.includes('google cloud')) {
      return 'gcp';
    }
    return undefined;
  }

  private resolveCloudProvider(currentDiagramType: string, answers: StructuredClarificationAnswer[] = [], promptText: string = ''): string | undefined {
    const cloudDiagramTypes = ['deployment-infrastructure', 'cloud-architecture', 'component-integration'];
    if (!cloudDiagramTypes.includes(currentDiagramType)) {
      return undefined;
    }
    if (this.preset && this.preset !== 'generic') {
      return this.preset;
    }
    const stateProvider = this.workspaceStateService.currentState?.architectureRequest?.cloudProvider;
    if (stateProvider && stateProvider !== 'generic') {
      return stateProvider;
    }
    const answerText = answers
      .map(answer => `${answer.question || ''} ${answer.answer || ''}`.trim())
      .join(' ');
    return this.inferCloudProviderFromText(`${answerText} ${promptText}`);
  }

  /**
   * Send chat message — uses WebSocket if connected, falls back to HTTP edit API.
   * Architecture edit requests will update diagram, overview, and code automatically.
   */
  sendMessage(): void {
    if ((this.chatInput.trim() || this.attachments.length > 0) && !this.isChatLoading) {
      const userMessage = this.chatInput.trim();
      const attachmentContext = this.getAttachmentContext();

      // Add user message to presentation messages via state service
      this.workspaceStateService.addChatMessage('user', userMessage, attachmentContext);
      this.presentationMessages = this.workspaceStateService.chatMessages;
      this.shouldScrollToBottom = true;

      this.chatInput = '';
      this.isChatLoading = true;
      this.streamingStatus = '';
      this.isStreamingUpdate = false;
      this.workspaceStateService.clearStreamingAssistantMessage();

      // Clear attachments after capturing context
      if (this.attachments.length > 0) {
        this.attachmentService.clearAttachments();
      }

      const currentDiagramType = this.diagramType?.value || 'deployment-infrastructure';
      const currentState = this.workspaceStateService.currentState;
      const resolvedProvider = this.resolveCloudProvider(
        currentDiagramType,
        currentState?.clarificationAnswers || this.discoveryAnswers,
        `${userMessage} ${this.prompt}`
      ) || 'aws';

      // Route 0: explain / overview intent — cheaper than re-running the
      // mutation crew. Routes to the lazy /diagrams/{id}/overview endpoint
      // when a v2 diagram is loaded; the assistant response is the
      // executiveSummary so the chat thread feels native.
      if (this.isOverviewIntent(userMessage)
          && this.canvasType === 'v2-maxgraph'
          && this.diagramId && this.workspaceId) {
        this.handleOverviewChatMessage(userMessage, resolvedProvider);
        return;
      }

      // Route 1: WebSocket (real-time streaming with progress events)
      if (this.wsConnectionState === 'connected') {
        console.log('[Workspace] Sending via WebSocket with attachments');
        // Minimal, single-step progress for a chat amendment (not a full
        // pipeline replay).
        this.resetWorkflowProgress('Applying your change', 'Applying your change…', true);
        this.wsService.sendChatMessage(userMessage, this.diagramData, resolvedProvider, attachmentContext);
        // Response handled by WS event subscriptions in initWebSocket()
        return;
      }

      // Route 2: HTTP edit API (synchronous, still applies architecture changes)
      console.log('[Workspace] Sending via SSE mutation API (WS not connected) with attachments');
      this.resetWorkflowProgress('Applying your change', 'Applying your change…', true);
      const sub = this.workflowJobService.runJob<any>('/api/v1/workspace-architect/jobs/mutation', {
        workspaceId: this.workspaceId,
        message: userMessage,
        currentDiagramSpec: this.diagramData,
        cloudProvider: resolvedProvider,
        diagramType: currentDiagramType,
        attachmentContext: attachmentContext || null,
      }).subscribe({
        next: update => {
          if (update.event) {
            this.applyWorkflowEvent(update.event);
          }
          if (update.kind === 'completed' && update.result) {
            console.log('[Workspace] SSE mutation result:', update.result.intentType);
            this.workflowProgressState = 'completed';
            this.workflowProgressPercent = 100;
            this.streamingStatus = '';
            this.isStreamingUpdate = false;
            this.applyMutationResult(update.result);
          }
        },
        error: (error: any) => {
          console.error('[Workspace] Edit failed:', error);
          this.workflowProgressState = 'failed';
          this.streamingStatus = '';
          this.isStreamingUpdate = false;
          this.workspaceStateService.addChatMessage('assistant', 'Sorry, I encountered an error processing your request. Please try again.');
          this.presentationMessages = this.workspaceStateService.chatMessages;
          this.shouldScrollToBottom = true;
          this.isChatLoading = false;
        }
      });

      this.subscriptions.push(sub);
    }
  }

  /**
   * Implement a recommendation from the overview tab.
   * Calls the workspace-architect implement endpoint and updates all views.
   */
  implementRecommendation(recommendationId: string): void {
    this.isImplementing = true;
    console.log('[Workspace] Implementing recommendation:', recommendationId);

    this.workspaceStateService.implementRecommendation(recommendationId).subscribe({
      next: (state: WorkspaceState) => {
        console.log('[Workspace] Recommendation implemented successfully');
        this.handleStructuredState(state);
        this.isImplementing = false;
      },
      error: (err) => {
        console.error('[Workspace] Recommendation implementation failed:', err);
        this.isImplementing = false;
      }
    });
  }

  /**
   * Handle quick actions from the chat tab
   */
  handleQuickAction(action: any): void {
    // Dynamic, diagram-aware suggestion → send its chat instruction straight
    // into the mutation flow (one-click "Add serverless for notifications").
    // Suggestions carry a `prompt`; static utilities fall through to the switch.
    const prompt = (action && typeof action === 'object') ? action.prompt : null;
    if (prompt && typeof prompt === 'string' && prompt.trim()) {
      this.chatInput = prompt.trim();
      this.setActiveTab('chat');
      this.sendMessage();
      return;
    }
    const actionId = typeof action === 'string' ? action : action?.id;
    console.log('[Workspace] Quick action:', actionId);
    switch (actionId) {
      case 'review-overview':
        this.setActiveTab('overview');
        break;
      case 'diagram-as-code':
        this.setActiveTab('code');
        break;
      case 'apply-improvements':
        this.setActiveTab('overview');
        break;
      case 'cost-optimization':
        this.chatInput = 'Apply cost optimization recommendations to this architecture';
        this.setActiveTab('chat');
        this.sendMessage();
        break;
      case 'security-hardening':
        this.chatInput = 'Apply security hardening best practices to this architecture';
        this.setActiveTab('chat');
        this.sendMessage();
        break;
      case 'ha-dr':
        this.chatInput = 'Configure high availability and disaster recovery for this architecture';
        this.setActiveTab('chat');
        this.sendMessage();
        break;
      default:
        console.warn('[Workspace] Unknown quick action:', actionId);
    }
  }

  /**
   * Format markdown bold syntax (**text**) to HTML <strong> tags
   */
  formatMarkdownBold(text: string): string {
    if (!text) return '';
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  /**
   * Turn a raw progress stage code (e.g. "COMPOSITION.GENERATE_STRUCTURE")
   * into a human, product-grade phase label ("Generating architecture
   * structure"). Falls back to title-casing the last dotted segment so a
   * never-before-seen stage still reads cleanly instead of as an enum.
   */
  prettyStage(stage: string | null | undefined): string {
    if (!stage) return '';
    const key = stage.trim().toUpperCase();
    const map: Record<string, string> = {
      'INTAKE.READY_GENERATE': 'Requirements understood',
      'INTAKE.ANALYZE': 'Analyzing your request',
      'INTAKE.CLARIFY': 'Clarifying requirements',
      'REQUIREMENT_INTAKE': 'Understanding requirements',
      'COMPOSITION.START': 'Starting composition',
      'COMPOSITION.GENERATE_STRUCTURE': 'Designing architecture structure',
      'COMPOSITION.BUILD_CANONICAL_MODEL': 'Building the architecture model',
      'COMPOSITION.RUNNING': 'Composing architecture',
      'COMPOSITION.COMPLETED': 'Architecture composed',
      'CANONICAL_ASSEMBLY': 'Assembling the diagram',
      'CANONICAL_ASSEMBLY.RUNNING': 'Assembling the diagram',
      'CANONICAL_ASSEMBLY.COMPLETED': 'Diagram assembled',
      'WORKSPACE.FINALIZE': 'Finalizing your workspace',
      'WORKSPACE_ASSEMBLY': 'Finalizing your workspace',
      'WORKSPACE_ASSEMBLY.RUNNING': 'Finalizing your workspace',
      'REASONING': 'Reasoning about the change',
      'COMPLETED': 'Done',
    };
    if (map[key]) return map[key];
    const seg = key.includes('.') ? key.substring(key.lastIndexOf('.') + 1) : key;
    return seg
      .toLowerCase()
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Regenerate diagram via API
   */
  regenerateDiagram(): void {
    this.errorMessage = '';
    this.generateArchitecture();
  }

  retryGeneration(): void {
    this.errorMessage = '';
    if (this.prompt && this.prompt.trim()) {
      this.generateArchitecture();
    }
  }

  /**
   * Generate unique workspace ID
   */
  private generateWorkspaceId(): string {
    return 'ws-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Zoom in on the current canvas
   */
  zoomIn(): void {
    if (this.canvasType === 'maxgraph' && this.maxgraphCanvas) {
      this.maxgraphCanvas.zoomIn();
    } else if (this.canvasType === 'mermaid' && this.mermaidCanvas) {
      this.mermaidCanvas.zoomIn();
    }
  }

  /**
   * Zoom out on the current canvas
   */
  zoomOut(): void {
    if (this.canvasType === 'maxgraph' && this.maxgraphCanvas) {
      this.maxgraphCanvas.zoomOut();
    } else if (this.canvasType === 'mermaid' && this.mermaidCanvas) {
      this.mermaidCanvas.zoomOut();
    }
  }

  /**
   * Reset zoom to fit the canvas
   */
  resetZoom(): void {
    if (this.canvasType === 'maxgraph' && this.maxgraphCanvas) {
      this.maxgraphCanvas.resetZoom();
    } else if (this.canvasType === 'mermaid' && this.mermaidCanvas) {
      this.mermaidCanvas.resetZoom();
    }
  }

  /**
   * Download diagram — legacy single-button entry kept for backwards compat.
   * Default format is PNG. New multi-format menu calls {@link exportAs}.
   */
  downloadDiagram(): void {
    this.exportAs('png');
  }

  /** Toggle the Export dropdown (PR5). */
  toggleExportMenu(): void {
    this.showExportMenu = !this.showExportMenu;
  }

  /** Close the export menu when clicking outside (called from HostListener). */
  closeExportMenu(): void {
    this.showExportMenu = false;
  }

  /** Triggered from each menu item — delegates to DiagramExportService. */
  async exportAs(format: DiagramExportFormat): Promise<void> {
    this.showExportMenu = false;
    if (this.isExporting) return;
    this.isExporting = true;
    try {
      const fileName = (this.diagramName || 'diagram').replace(/\s+/g, '-').toLowerCase();
      let svgElement: SVGElement | null = null;
      if (this.canvasType === 'maxgraph' && this.maxgraphCanvas) {
        svgElement = this.maxgraphCanvas.getSvgElement();
      } else if (this.canvasType === 'mermaid' && this.mermaidCanvas) {
        // Mermaid renders straight into the DOM — fall back to its own SVG export
        // for SVG / PNG and reject drawio / json (no equivalent semantics).
        if (format === 'svg' || format === 'png') {
          this.mermaidCanvas.downloadAsSVG();
          return;
        }
        throw new Error('drawio / json export is not supported for mermaid diagrams');
      }

      const diagramId = this.workspaceId || null;
      await this.diagramExportService.export(format, svgElement, diagramId, { fileName });
    } catch (err) {
      console.error('[Workspace] Export failed:', err);
      this.errorMessage = `Export failed: ${(err as Error).message || err}`;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Toggle chat window collapse/expand
   */
  toggleChat(): void {
    this.isChatCollapsed = !this.isChatCollapsed;
  }

  /**
   * Switch between tabs
   */
  setActiveTab(tab: 'chat' | 'code' | 'overview' | 'insert'): void {
    this.activeTab = tab;
    if (this.isChatCollapsed) {
      this.isChatCollapsed = false;
    }
    // Lazily fetch the rich overview the first time the Overview tab is opened
    // for the current diagram version. The narrator agent is expensive, so we
    // only run it when the user actually looks; the server caches by version,
    // so re-opening is instant. (Replaces the removed "Explain this
    // architecture" button under the canvas — its content now lives here.)
    if (tab === 'overview'
        && !!this.diagramId && !!this.workspaceId
        && !this.overviewLoading
        && this.overviewLoadedVersion !== (this.layoutIR?.version ?? 'v0')) {
      this.loadOverview();
    }
  }

  /**
   * Called when Requirements Analyzer completes on workspace
   */
  onDiscoveryComplete(result: DiscoveryResult): void {
    console.log('[Workspace] Discovery complete:', result);
    this.showDiscoveryDialog = false;
    
    // Update prompt with enriched version
    if (result.enrichedPrompt) {
      this.prompt = result.enrichedPrompt;
    }
    
    // Store discovery answers and confidence
    this.discoveryAnswers = result.answers;
    this.discoveryConfidence = result.confidence;
    this.resolvedSystemName = result.askSummary || this.resolvedSystemName;

    // Capture intakeArtifactId from discovery for artifact-first composition
    if (result.intakeArtifactId) {
      this.pendingIntakeArtifactId = result.intakeArtifactId;
      console.log('[Workspace] Using intakeArtifactId from discovery:', this.pendingIntakeArtifactId);
    }

    this.workspaceStateService.ensureWorkspaceState({
      workspaceId: this.workspaceId,
      prompt: this.prompt,
      diagramType: this.diagramType?.value || 'deployment-infrastructure',
      cloudProvider: this.resolveCloudProvider(this.diagramType?.value || 'deployment-infrastructure', [], this.prompt),
      intakeArtifactId: this.pendingIntakeArtifactId || undefined,
      resolvedSystemName: this.resolvedSystemName || undefined,
    });
    this.presentationMessages = this.workspaceStateService.chatMessages;
    
    // Display discovery answers in chat
    if (this.discoveryAnswers.length > 0) {
      this.addDiscoveryAnswersToChat();
    }
    
    // Now start architecture generation with enriched prompt + intakeArtifactId
    this.generateArchitecture();
  }

  /**
   * Called when Requirements Analyzer dialog is closed without proceeding
   */
  onDiscoveryClosed(): void {
    console.log('[Workspace] Discovery closed without completion');
    this.showDiscoveryDialog = false;
    this.preloadedIntakeQuestions = [];
    
    // Generate with original prompt anyway (skip clarification)
    if (this.prompt && this.prompt.trim()) {
      // this.generateArchitecture();
    } else {
      this.isLoading = false;
    }
  }

  // === Attachment Methods ===

  /**
   * Handle files dropped via drag and drop
   */
  onFilesDropped(files: FileList): void {
    const fileArray = Array.from(files);
    console.log('[Workspace] Files dropped:', fileArray.map(f => f.name));
    
    this.attachmentService.handleDrop(files, this.workspaceId)
      .subscribe({
        next: (uploadedAttachments) => {
          console.log('[Workspace] Files uploaded:', uploadedAttachments);
        },
        error: (error) => {
          console.error('[Workspace] Upload failed:', error);
        }
      });
  }

  /**
   * Handle files pasted from clipboard
   */
  onFilesPasted(dataTransfer: DataTransfer): void {
    console.log('[Workspace] Files pasted');
    
    this.attachmentService.handlePaste({ clipboardData: dataTransfer } as ClipboardEvent, this.workspaceId)
      .subscribe({
        next: (uploadedAttachments) => {
          console.log('[Workspace] Files pasted:', uploadedAttachments);
        },
        error: (error) => {
          console.error('[Workspace] Paste failed:', error);
        }
      });
  }

  /**
   * Handle drop event for files on chat textarea
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.onFilesDropped(files);
    }
  }

  /**
   * Handle paste event for text and files
   */
  onPaste(event: ClipboardEvent): void {
    // Let the attachment service handle file pastes
    this.attachmentService.handlePaste(event, this.workspaceId)
      .subscribe({
        next: (uploadedAttachments) => {
          if (uploadedAttachments.length > 0) {
            console.log('[Workspace] Files pasted:', uploadedAttachments);
          }
        },
        error: (error) => {
          console.error('[Workspace] Paste failed:', error);
        }
      });
  }

  /**
   * Remove an attachment
   */
  onRemoveAttachment(id: string): void {
    console.log('[Workspace] Removing attachment:', id);
    this.attachmentService.removeAttachment(id);
  }

  /**
   * Retry uploading an attachment
   */
  onRetryAttachment(id: string): void {
    console.log('[Workspace] Retrying attachment:', id);
    // Implementation would depend on retry logic
  }

  /**
   * Get attachment context for agents — includes actual file contents
   */
  getAttachmentContext(): any {
    const ctx = this.attachmentService.toAgentContext();
    // Enrich with file contents for agent processing
    if (ctx.hasAttachments) {
      ctx.artifactContents = ctx.attachments
        .filter((a: any) => a.extractedText || a.type === 'text' || a.type === 'document')
        .map((a: any) => ({
          content: a.extractedText || '',
          type: a.mimeType?.includes('json') ? 'dac_json' : (a.mimeType?.includes('xml') ? 'drawio' : 'text_doc'),
          filename: a.name,
        }));
    }
    return ctx;
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
handleEnter(event: Event) {
  const keyboardEvent = event as KeyboardEvent;

  if (!keyboardEvent.shiftKey) {
    keyboardEvent.preventDefault();
    this.sendMessage();
  }
}

autoResize(event: any) {
  const textarea = event.target;
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
}
