/**
 * WorkspaceStateService — Single source of truth for workspace architecture state.
 *
 * Calls the new structured /workspace-architect endpoints (BFF → Agent) and
 * exposes typed observables for Chat, Overview, Diagram, and Recommendations.
 * All tabs render from this shared state — never from raw text blobs.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { map, catchError, tap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ── Typed Models ──────────────────────────────────────────────────────────────

export interface ClarificationAnswer {
  questionId: string;
  question: string;
  answer: string;
  dimension?: string;
}

export interface ComponentInfo {
  id: string;
  name: string;
  type: string;
  layer: string;
  description: string;
  icon?: string;
  provider?: string;
}

export interface ComponentGroup {
  layer: string;
  label: string;
  components: ComponentInfo[];
}

export interface ArchitecturePrinciple {
  name: string;
  description: string;
  rationale: string;
}

export interface PatternUsed {
  name: string;
  description: string;
  applicability: string;
}

export interface Consideration {
  category: string;
  title: string;
  description: string;
  severity: string;
}

export interface Improvement {
  id: string;
  title: string;
  rationale: string;
  category: string;
  impact: string;
  effort: string;
  implemented: boolean;
  implementationAction?: string;
}

export interface OverviewNarrativeEntry {
  title: string;
  description: string;
}

export interface OverviewDecision {
  title: string;
  decision: string;
  rationale: string;
  category: string;
}

export interface OverviewTradeoff {
  dimension: string;
  choice: string;
  rationale: string;
  impact: string;
}

export interface OverviewModel {
  executiveSummary: string;
  architectureRationale?: OverviewNarrativeEntry[];
  componentRationale?: OverviewNarrativeEntry[];
  dataFlowSummary?: OverviewNarrativeEntry[];
  securitySummary?: OverviewNarrativeEntry[];
  wellArchitectedAlignment?: OverviewNarrativeEntry[];
  principleAlignment?: OverviewNarrativeEntry[];
  architectureDecisions?: OverviewDecision[];
  tradeoffs?: OverviewTradeoff[];
  risks?: string[];
  componentGroups: ComponentGroup[];
  principles: ArchitecturePrinciple[];
  patterns: PatternUsed[];
  considerations: Consideration[];
  improvements: Improvement[];
}

export interface ChatPresentationMessage {
  id: string;
  type: string; // request_summary | synthesis | clarification_summary | quick_actions | assistant | user
  content: string;
  metadata?: any;
  timestamp?: string;
}

// ── Context-aware pipeline types ─────────────────────────────────────────────

export interface PillarScore {
  pillar: string;
  displayName: string;
  score: number;
  checksMet: number;
  checksTotal: number;
  topGaps: string[];
}

export interface PrincipleCheck {
  principleId: string;
  pillar: string;
  name: string;
  status: string; // met | partially_met | not_met | not_applicable
  evidence: string[];
  recommendations: string[];
  severity: string;
}

export interface PrincipleEvaluation {
  overallScore: number;
  summary: string;
  pillarScores: PillarScore[];
  checks: PrincipleCheck[];
  topologyRecommendations: any[];
}

export interface DeltaCounts {
  new: number;
  removed: number;
  modified: number;
  retained: number;
  newEdges: number;
  removedEdges: number;
}

export interface ComponentChange {
  id: string;
  label: string;
  changeType: string; // new | removed | modified | retained
  layer: string;
  iconId: string;
  details: string;
}

export interface MigrationConsideration {
  category: string;
  title: string;
  description: string;
  effort: string;
  risk: string;
  order: number;
}

export interface DeltaSummary {
  newComponents: ComponentChange[];
  removedComponents: ComponentChange[];
  modifiedComponents: ComponentChange[];
  retainedComponents: ComponentChange[];
  newEdges: any[];
  removedEdges: any[];
  newBoundaries: any[];
  removedBoundaries: any[];
  migrationConsiderations: MigrationConsideration[];
  changeNarrative: string;
  asIsSummary: string;
  toBeSummary: string;
  totalChanges: number;
  counts: DeltaCounts;
}

export interface ArchitectureContextSummary {
  mode: string;          // greenfield | enhance | transform | review
  template: string;
  depthProfile: {
    depthLevel: string;       // conceptual | logical | deployment | detailed-deployment
    environmentClass: string; // dev | test | uat | staging | prod | dr
    criticalityLevel: string; // low | medium | high | mission-critical
    numAzs: number;
    rationale: string[];
    wellArchitectedWeights: Record<string, number>;
    [key: string]: any;
  };
  systemName: string;
  domain: string;
  services: string[];
  haStrategy: string;
  drStrategy: string;
  scalingStrategy: string;
  assumptions: any[];
  [key: string]: any;
}

export interface WorkspaceState {
  workspaceId: string;
  projectId?: string;
  resolvedSystemName?: string;
  architectureRequest: {
    prompt: string;
    diagramType: string;
    cloudProvider: string;
    architectureMode?: string;
    depthLevel?: string;
    environmentClass?: string;
    criticalityLevel?: string;
  };
  clarificationAnswers?: ClarificationAnswer[];
  architectureModel?: any; // legacy DiagramSpec (mermaid + v1 maxGraph)
  /**
   * v2 LayoutIR (mixed-coordinate region/group/leaf tree). Populated when
   * the BFF routes composition through diagram-service-v2 — see
   * WorkflowOrchestratorImpl.executeCompositionFromArtifact. Consumed by
   * V2MaxGraphCanvasComponent. Present alongside (or instead of) the
   * legacy architectureModel during the v2 cutover.
   */
  layoutIR?: any;
  /** Engine hint set by BFF: "v2" when the v2 path was used. */
  composeEngine?: string;
  /** v2 diagram identifier (UUID) — used for /diagrams/{id}/overview lookups. */
  diagramId?: string;
  overview?: OverviewModel;
  recommendations: Improvement[];
  appliedRecommendations: string[];
  chatPresentationMessages: ChatPresentationMessage[];
  diagramCode?: string;
  status: string;
  // View-type tracking
  diagramType?: string;       // e.g. 'c4-system-context', 'deployment-infrastructure'
  canvasType?: string;        // 'maxgraph' | 'mermaid'
  // Attached artifacts for context
  attachedArtifacts?: { content: string; type: string; filename?: string }[];
  // Context-aware pipeline outputs
  architectureContext?: ArchitectureContextSummary;
  principleEvaluation?: PrincipleEvaluation;
  deltaSummary?: DeltaSummary;
  // Workflow artifact IDs for handoff and resume
  intakeArtifactId?: string;
  planningArtifactId?: string;
  compositionSessionId?: string;
  // Composition-specific metadata
  designDecisions?: any[];
  tradeoffs?: any[];
  deferredCapabilities?: string[];
  taskTrace?: Record<string, string>;
}

export interface WorkspaceGenerateRequest {
  prompt: string;
  workspaceId: string;        // mandatory — composition is always workspace-scoped
  intakeArtifactId: string;   // mandatory — must come from /discovery/analyze or /discovery/clarify
  diagramType?: string;
  preset?: string;            // e.g. "aws", "azure", "gcp", "hybrid", "generic"
  cloudProvider?: string;
  projectId?: string;
  clarificationAnswers?: ClarificationAnswer[];
  attachedDocuments?: any[];
  // Existing architecture support
  existingDiagramSpec?: any;
  existingArtifacts?: { content: string; type: string; filename?: string }[];
  architectureMode?: string;    // greenfield | enhance | transform | review
  depthLevel?: string;          // conceptual | logical | deployment | detailed-deployment
  environmentClass?: string;    // dev | test | uat | staging | prod | dr
  criticalityLevel?: string;    // low | medium | high | mission-critical
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  private readonly bffUrl = (environment.api as any).architectureServiceUrl || '';
  private readonly agentUrl = (environment.api as any).agentServiceUrl || '';

  // Reactive state
  private stateSubject = new BehaviorSubject<WorkspaceState | null>(null);
  public state$ = this.stateSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string>('');
  public error$ = this.errorSubject.asObservable();
  private readonly streamingAssistantMessageId = '__streaming_assistant__';

  constructor(private http: HttpClient) {
    console.log('[WorkspaceStateService] Initialized, BFF:', this.bffUrl, 'Agent:', this.agentUrl);
  }

  /** Get current state snapshot */
  get currentState(): WorkspaceState | null {
    return this.stateSubject.value;
  }

  /** Get current overview */
  get overview(): OverviewModel | null {
    return this.stateSubject.value?.overview || null;
  }

  /** Get current recommendations */
  get recommendations(): Improvement[] {
    return this.stateSubject.value?.recommendations || [];
  }

  /** Get current chat messages */
  get chatMessages(): ChatPresentationMessage[] {
    return this.normalizePresentationMessages(this.stateSubject.value?.chatPresentationMessages || []);
  }

  normalizeChatPresentationMessages(messages: ChatPresentationMessage[]): ChatPresentationMessage[] {
    return this.normalizePresentationMessages(messages);
  }

  /** Get architecture model (DiagramSpec) */
  get architectureModel(): any {
    return this.stateSubject.value?.architectureModel || null;
  }

  /** Get current diagram type (e.g. 'c4-system-context', 'deployment-infrastructure') */
  get currentDiagramType(): string {
    return this.stateSubject.value?.diagramType
      || this.stateSubject.value?.architectureRequest?.diagramType
      || 'deployment-infrastructure';
  }

  /** Get current canvas type */
  get currentCanvasType(): string {
    return this.stateSubject.value?.canvasType || 'maxgraph';
  }

  /** Set diagram type (called when user changes dropdown) */
  setDiagramType(diagramType: string, canvasType: string): void {
    const current = this.stateSubject.value;
    if (!current) return;
    this.stateSubject.next({ ...current, diagramType, canvasType });
  }

  /** Add attached artifacts to workspace state */
  addAttachedArtifacts(artifacts: { content: string; type: string; filename?: string }[]): void {
    const current = this.stateSubject.value;
    if (!current) return;
    const existing = current.attachedArtifacts || [];
    this.stateSubject.next({ ...current, attachedArtifacts: [...existing, ...artifacts] });
  }

  ensureWorkspaceState(seed: {
    workspaceId: string;
    prompt: string;
    diagramType?: string;
    cloudProvider?: string;
    intakeArtifactId?: string;
    clarificationAnswers?: ClarificationAnswer[];
    resolvedSystemName?: string;
  }): void {
    const current = this.stateSubject.value;
    if (!current || (seed.workspaceId && current.workspaceId && current.workspaceId !== seed.workspaceId)) {
      const requestSummaryMessage = this.buildRequestSummaryMessage(seed.prompt, seed.clarificationAnswers, seed.resolvedSystemName);
      this.stateSubject.next({
        workspaceId: seed.workspaceId,
        resolvedSystemName: seed.resolvedSystemName,
        architectureRequest: {
          prompt: seed.prompt,
          diagramType: seed.diagramType || 'deployment-infrastructure',
          cloudProvider: seed.cloudProvider || '',
        },
        clarificationAnswers: seed.clarificationAnswers,
        recommendations: [],
        appliedRecommendations: [],
        chatPresentationMessages: requestSummaryMessage ? [requestSummaryMessage] : [],
        status: 'initializing',
        diagramType: seed.diagramType || 'deployment-infrastructure',
        canvasType: 'maxgraph',
        intakeArtifactId: seed.intakeArtifactId,
      });
      return;
    }

    const requestSummaryMessage = this.buildRequestSummaryMessage(
      seed.prompt || current.architectureRequest?.prompt || '',
      seed.clarificationAnswers || current.clarificationAnswers,
      seed.resolvedSystemName || current.resolvedSystemName
    );
    this.stateSubject.next({
      ...current,
      workspaceId: seed.workspaceId || current.workspaceId,
      resolvedSystemName: seed.resolvedSystemName || current.resolvedSystemName,
      architectureRequest: {
        ...current.architectureRequest,
        prompt: seed.prompt || current.architectureRequest?.prompt || '',
        diagramType: seed.diagramType || current.architectureRequest?.diagramType || 'deployment-infrastructure',
        cloudProvider: seed.cloudProvider || current.architectureRequest?.cloudProvider || '',
      },
      clarificationAnswers: seed.clarificationAnswers || current.clarificationAnswers,
      chatPresentationMessages: requestSummaryMessage
        ? this.upsertRequestSummaryMessage(current.chatPresentationMessages || [], requestSummaryMessage)
        : current.chatPresentationMessages,
      intakeArtifactId: seed.intakeArtifactId || current.intakeArtifactId,
      diagramType: seed.diagramType || current.diagramType || current.architectureRequest?.diagramType || 'deployment-infrastructure',
    });
  }

  appendChatMessages(messages: ChatPresentationMessage[]): void {
    const current = this.stateSubject.value;
    if (!current || !messages.length) return;

    this.stateSubject.next({
      ...current,
      chatPresentationMessages: this.mergeChatMessages(current.chatPresentationMessages, messages),
    });
  }

  upsertStreamingAssistantMessage(content: string): void {
    const current = this.stateSubject.value;
    if (!current) return;

    const nextMessage: ChatPresentationMessage = {
      id: this.streamingAssistantMessageId,
      type: 'assistant',
      content,
      metadata: { streaming: true },
      timestamp: new Date().toISOString(),
    };
    const messages = [...current.chatPresentationMessages];
    const existingIndex = messages.findIndex(msg => msg.id === this.streamingAssistantMessageId);

    if (existingIndex >= 0) {
      messages[existingIndex] = nextMessage;
    } else {
      messages.push(nextMessage);
    }

    this.stateSubject.next({ ...current, chatPresentationMessages: messages });
  }

  finalizeStreamingAssistantMessage(content?: string): void {
    const current = this.stateSubject.value;
    if (!current) return;

    const messages = [...current.chatPresentationMessages];
    const existingIndex = messages.findIndex(msg => msg.id === this.streamingAssistantMessageId);
    const normalizedContent = content?.trim();
    const hasDuplicateAssistantMessage = !!normalizedContent && messages.some(msg =>
      msg.id !== this.streamingAssistantMessageId
      && msg.type === 'assistant'
      && !msg.metadata?.streaming
      && typeof msg.content === 'string'
      && msg.content.trim() === normalizedContent
    );

    if (existingIndex < 0) {
      if (normalizedContent && !hasDuplicateAssistantMessage) {
        this.addChatMessage('assistant', normalizedContent);
      }
      return;
    }

    const existing = messages[existingIndex];
    const finalContent = normalizedContent || existing.content;
    if (!finalContent?.trim() || hasDuplicateAssistantMessage) {
      messages.splice(existingIndex, 1);
    } else {
      messages[existingIndex] = {
        ...existing,
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        content: finalContent,
        metadata: { ...(existing.metadata || {}), streaming: false },
        timestamp: new Date().toISOString(),
      };
    }

    this.stateSubject.next({ ...current, chatPresentationMessages: messages });
  }

  clearStreamingAssistantMessage(): void {
    const current = this.stateSubject.value;
    if (!current) return;

    this.stateSubject.next({
      ...current,
      chatPresentationMessages: current.chatPresentationMessages.filter(msg => msg.id !== this.streamingAssistantMessageId),
    });
  }

  /**
   * Generate a full structured workspace state from prompt + clarifications.
   * Calls BFF which routes to canonical crew workflows.
   */
  generateWorkspace(request: WorkspaceGenerateRequest): Observable<WorkspaceState> {
    this.loadingSubject.next(true);
    this.errorSubject.next('');

    const bffUrl = `${this.bffUrl}/api/v1/workspace-architect/generate`;
    const body: any = {
      prompt: request.prompt,
      diagramType: request.diagramType || 'deployment-infrastructure',
      preset: request.preset || undefined,
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      clarificationAnswers: request.clarificationAnswers,
      attachedDocuments: request.attachedDocuments,
    };
    if (request.cloudProvider) {
      body.cloudProvider = request.cloudProvider;
    }

    console.log('[WorkspaceStateService] Generating workspace via BFF:', bffUrl);

    return this.http.post<WorkspaceState>(bffUrl, body).pipe(
      timeout(300000),  // 5 minutes for local LLM support
      tap(state => {
        console.log('[WorkspaceStateService] BFF generation successful');
        this.stateSubject.next(this.normalizeWorkspaceState(state));
        this.loadingSubject.next(false);
      }),
      catchError(bffErr => {
        console.error('[WorkspaceStateService] BFF generation failed:', bffErr.message);
        this.loadingSubject.next(false);
        this.errorSubject.next('Architecture generation failed. BFF service may be unavailable.');
        return throwError(() => bffErr);
      })
    );
  }

  applyCompositionState(nextState: WorkspaceState, request: WorkspaceGenerateRequest): void {
    const current = this.stateSubject.value;
    const mergedState: WorkspaceState = {
      ...(current || {}),
      ...nextState,
      workspaceId: nextState.workspaceId || request.workspaceId,
      resolvedSystemName: nextState.resolvedSystemName || current?.resolvedSystemName,
      intakeArtifactId: nextState.intakeArtifactId || request.intakeArtifactId,
      architectureRequest: {
        ...(current?.architectureRequest || {
          prompt: request.prompt,
          diagramType: request.diagramType || 'deployment-infrastructure',
          cloudProvider: request.cloudProvider || request.preset || '',
        }),
        ...(nextState.architectureRequest || {}),
      },
      chatPresentationMessages: this.mergeChatMessages(
        current?.chatPresentationMessages || [],
        nextState.chatPresentationMessages || []
      ),
    };
    this.stateSubject.next(this.normalizeWorkspaceState(mergedState));
  }

  applyEditResult(result: any): void {
    const current = this.stateSubject.value;
    if (!current) {
      return;
    }
    if (result.intentType === 'architecture_edit' && result.updatedArchitectureModel) {
      this.stateSubject.next(this.normalizeWorkspaceState({
        ...current,
        architectureModel: result.updatedArchitectureModel,
        overview: result.updatedOverview || current.overview,
        diagramCode: result.updatedDiagramCode || current.diagramCode,
        chatPresentationMessages: [
          ...current.chatPresentationMessages,
          ...(result.chatMessages || []),
        ],
      }));
      return;
    }
    if (result.chatMessages?.length) {
      this.stateSubject.next(this.normalizeWorkspaceState({
        ...current,
        chatPresentationMessages: [
          ...current.chatPresentationMessages,
          ...result.chatMessages,
        ],
      }));
    }
  }

  /**
   * Generate workspace via the Architecture Composition pipeline.
   * MANDATORY: workspaceId + intakeArtifactId (from /discovery/analyze → /discovery/clarify).
   * No fallback/degradation — callers must complete the analyze→clarify loop first.
   */
  generateViaComposition(request: WorkspaceGenerateRequest): Observable<any> {
    this.loadingSubject.next(true);
    this.errorSubject.next('');

    const bffUrl = `${this.bffUrl}/api/v1/workspace-architect/generate-composition`;
    const body: any = {
      workspaceId: request.workspaceId,
      intakeArtifactId: request.intakeArtifactId,
      prompt: request.prompt,
      diagramType: request.diagramType || 'deployment-infrastructure',
      preset: request.preset || undefined,
      projectId: request.projectId,
      clarificationAnswers: request.clarificationAnswers,
      attachedDocuments: request.attachedDocuments,
    };
    if (request.cloudProvider) {
      body.cloudProvider = request.cloudProvider;
    }

    console.log('[WorkspaceStateService] Generating via composition pipeline:', bffUrl,
      `ws=${request.workspaceId}, intake=${request.intakeArtifactId}`);

    return this.http.post<any>(bffUrl, body).pipe(
      timeout(300000),
      tap(response => {
        console.log('[WorkspaceStateService] Composition generation successful');
        this.applyCompositionState(response as WorkspaceState, request);
        this.loadingSubject.next(false);
      }),
      catchError(compErr => {
        console.error('[WorkspaceStateService] Composition pipeline failed:', compErr.message);
        this.loadingSubject.next(false);
        this.errorSubject.next('Architecture composition failed. Please try again.');
        return throwError(() => compErr);
      })
    );
  }

  /**
   * Chat-based composition refinement — delta instruction + optional new attachments.
   * Reuses the latest composition/intake artifact. Does NOT restart from scratch.
   */
  updateComposition(workspaceId: string, deltaInstruction: string,
                    newAttachments?: any[], intakeArtifactId?: string): Observable<any> {
    this.loadingSubject.next(true);
    this.errorSubject.next('');

    const bffUrl = `${this.bffUrl}/api/v1/workspace-architect/composition/update`;
    const body: any = {
      workspaceId,
      deltaInstruction,
      intakeArtifactId: intakeArtifactId || this.stateSubject.value?.intakeArtifactId || '',
    };
    if (newAttachments && newAttachments.length > 0) {
      body.newAttachments = newAttachments;
    }

    console.log('[WorkspaceStateService] Composition update:', deltaInstruction.substring(0, 60));

    return this.http.post<any>(bffUrl, body).pipe(
      timeout(300000),
      tap(response => {
        console.log('[WorkspaceStateService] Composition update successful');
        this.stateSubject.next(this.normalizeWorkspaceState(response as WorkspaceState));
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[WorkspaceStateService] Composition update failed:', err.message);
        this.loadingSubject.next(false);
        this.errorSubject.next('Composition update failed. Please try again.');
        return throwError(() => err);
      })
    );
  }

  /**
   * Resume a paused workflow with clarification answers.
   * Uses the dedicated resume endpoint for efficient artifact-based resume.
   * Falls back to re-calling generateWorkspace with answers.
   */
  resumeWorkflow(workspaceId: string, clarificationAnswers: ClarificationAnswer[], originalRequest?: WorkspaceGenerateRequest): Observable<WorkspaceState> {
    this.loadingSubject.next(true);
    this.errorSubject.next('');

    const bffUrl = `${this.bffUrl}/api/v1/workspace-architect/generate`;
    const body: any = {
      prompt: originalRequest?.prompt || '',
      diagramType: originalRequest?.diagramType || this.currentDiagramType,
      workspaceId,
      projectId: originalRequest?.projectId || '',
      clarificationAnswers: clarificationAnswers.map(a => ({
        questionId: a.questionId,
        question: a.question,
        answer: a.answer,
      })),
    };
    if (originalRequest?.cloudProvider) {
      body.cloudProvider = originalRequest.cloudProvider;
    }

    console.log('[WorkspaceStateService] Resuming workflow via BFF for workspace:', workspaceId);

    return this.http.post<WorkspaceState>(bffUrl, body).pipe(
      timeout(300000),
      tap(state => {
        console.log('[WorkspaceStateService] Workflow resume successful');
        this.stateSubject.next(this.normalizeWorkspaceState(state));
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[WorkspaceStateService] Workflow resume failed:', err.message);
        this.loadingSubject.next(false);
        this.errorSubject.next('Failed to resume workflow with clarification answers.');
        return throwError(() => err);
      })
    );
  }

  /**
   * Implement a single recommendation.
   * Updates the full workspace state (diagram, overview, recommendations, chat).
   */
  implementRecommendation(recommendationId: string): Observable<WorkspaceState> {
    const currentState = this.stateSubject.value;
    if (!currentState) {
      return throwError(() => new Error('No workspace state available'));
    }

    this.loadingSubject.next(true);

    const bffUrl = `${this.bffUrl}/api/v1/workspace-architect/implement`;
    const body = {
      workspaceId: currentState.workspaceId,
      recommendationId,
      currentDiagramSpec: currentState.architectureModel,
    };

    console.log('[WorkspaceStateService] Implementing recommendation:', recommendationId);

    return this.http.post<WorkspaceState>(bffUrl, body).pipe(
      timeout(300000),  // 5 minutes for local LLM support
      tap(newState => {
        // Merge: keep original request context, apply updated model/overview/recs
        const merged: WorkspaceState = {
          ...currentState,
          architectureModel: newState.architectureModel || currentState.architectureModel,
          overview: newState.overview || currentState.overview,
          recommendations: this.mergeRecommendations(currentState.recommendations, newState),
          appliedRecommendations: [
            ...currentState.appliedRecommendations,
            recommendationId,
          ],
          diagramCode: newState.diagramCode || currentState.diagramCode,
          chatPresentationMessages: [
            ...currentState.chatPresentationMessages,
            ...(newState.chatPresentationMessages || []),
          ],
        };
        this.stateSubject.next(this.normalizeWorkspaceState(merged));
        this.loadingSubject.next(false);
        console.log('[WorkspaceStateService] Recommendation implemented:', recommendationId);
      }),
      catchError(err => {
        this.loadingSubject.next(false);
        this.errorSubject.next('Failed to implement recommendation.');
        return throwError(() => err);
      })
    );
  }

  /**
   * Send an edit/follow-up message via HTTP (fallback when WS is unavailable).
   * Returns the full EditIntentResult from the agent.
   */
  editWorkspace(message: string, currentDiagramSpec?: any, cloudProvider?: string, attachmentContext?: any): Observable<any> {
    const bffUrl = `${this.bffUrl}/api/v1/workspace-architect/edit`;
    const body = {
      workspaceId: this.stateSubject.value?.workspaceId || '',
      message,
      currentDiagramSpec: currentDiagramSpec || this.stateSubject.value?.architectureModel,
      cloudProvider: cloudProvider || undefined,
      diagramType: this.currentDiagramType,
      attachmentContext: attachmentContext || null,
    };

    console.log('[WorkspaceStateService] Edit via HTTP:', message.substring(0, 60));

    return this.http.post<any>(bffUrl, body).pipe(
      timeout(300000),  // 5 minutes for local LLM support
      tap(result => {
        this.applyEditResult(result);
      }),
      catchError(err => {
        console.warn('[WorkspaceStateService] HTTP edit failed, trying agents direct:', err.message);
        return this.editWorkspaceDirect(body);
      })
    );
  }

  /**
   * Direct fallback: call Python agents /api/v1/workspace-architect/edit
   */
  private editWorkspaceDirect(body: any): Observable<any> {
    const url = `${this.agentUrl}/api/v1/workspace-architect/edit`;
    return this.http.post<any>(url, body).pipe(
      timeout(60000),
      tap(result => {
        this.applyEditResult(result);
      }),
      catchError(err => {
        console.error('[WorkspaceStateService] Both BFF and agent edit failed:', err.message);
        return throwError(() => err);
      })
    );
  }

  /**
   * Add a user or assistant chat message to the presentation messages.
   */
  addChatMessage(type: string, content: string, metadata?: any): void {
    const current = this.stateSubject.value;
    if (!current) return;

    const msg: ChatPresentationMessage = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      type,
      content,
      metadata,
      timestamp: new Date().toISOString(),
    };

    this.stateSubject.next({
      ...current,
      chatPresentationMessages: [...current.chatPresentationMessages, msg],
    });
  }

  /**
   * Update diagram code in the state (e.g., after editing in Diagram-as-Code tab).
   */
  updateDiagramCode(code: string): void {
    const current = this.stateSubject.value;
    if (!current) return;
    this.stateSubject.next({ ...current, diagramCode: code });
  }

  /**
   * Update the architecture model (DiagramSpec) in the state.
   */
  updateArchitectureModel(model: any): void {
    const current = this.stateSubject.value;
    if (!current) return;
    this.stateSubject.next({ ...current, architectureModel: model });
  }

  /**
   * Reset the workspace state.
   */
  reset(): void {
    this.stateSubject.next(null);
    this.loadingSubject.next(false);
    this.errorSubject.next('');
  }

  /**
   * Merge recommendations: mark implemented ones, keep new ones from agent response.
   */
  private mergeRecommendations(existing: Improvement[], newState: WorkspaceState): Improvement[] {
    const applied = new Set(newState.appliedRecommendations || []);
    const newRecs = newState.recommendations || [];

    // Use new recommendations list but preserve implementation status
    return newRecs.map(rec => ({
      ...rec,
      implemented: rec.implemented || applied.has(rec.id),
    }));
  }

  private normalizeWorkspaceState(state: WorkspaceState): WorkspaceState {
    return {
      ...state,
      chatPresentationMessages: this.normalizePresentationMessages(state?.chatPresentationMessages || []),
    };
  }

  private buildRequestSummaryMessage(prompt: string, clarificationAnswers?: ClarificationAnswer[], resolvedSystemName?: string): ChatPresentationMessage | null {
    const trimmedPrompt = (prompt || '').trim();
    const trimmedSystemName = (resolvedSystemName || '').trim();
    const clarificationItems = (clarificationAnswers || [])
      .map(answer => ({
        question: answer?.question || '',
        answer: answer?.answer || '',
      }))
      .filter(item => item.question && item.answer);

    if (!trimmedPrompt && clarificationItems.length === 0) {
      return null;
    }

    return {
      id: '__request_summary__',
      type: 'request_summary',
      content: trimmedSystemName || trimmedPrompt,
      metadata: {
        originalPrompt: trimmedPrompt,
        resolvedSystemName: trimmedSystemName,
        clarificationItems,
        clarificationCount: clarificationItems.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private upsertRequestSummaryMessage(messages: ChatPresentationMessage[], requestSummaryMessage: ChatPresentationMessage): ChatPresentationMessage[] {
    const existingIndex = messages.findIndex(msg => msg.type === 'request_summary');
    if (existingIndex < 0) {
      return [requestSummaryMessage, ...messages];
    }

    const nextMessages = [...messages];
    nextMessages[existingIndex] = {
      ...nextMessages[existingIndex],
      ...requestSummaryMessage,
      metadata: {
        ...(nextMessages[existingIndex].metadata || {}),
        ...(requestSummaryMessage.metadata || {}),
      },
      timestamp: requestSummaryMessage.timestamp,
    };
    return nextMessages;
  }

  private normalizePresentationMessages(messages: ChatPresentationMessage[]): ChatPresentationMessage[] {
    const normalized: ChatPresentationMessage[] = [];

    for (const message of messages || []) {
      const nextMessage: ChatPresentationMessage = {
        ...message,
        id: message.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      };

      if (nextMessage.type === 'clarification_summary') {
        const clarificationItems = ((nextMessage.metadata?.chips || nextMessage.metadata?.clarificationItems || []) as any[])
          .map(item => ({
            question: item?.question || item?.label || '',
            answer: item?.answer || item?.value || '',
          }))
          .filter(item => item.question && item.answer);

        const requestSummaryIndex = [...normalized]
          .map((msg, index) => ({ msg, index }))
          .reverse()
          .find(entry => entry.msg.type === 'request_summary')?.index;

        if (requestSummaryIndex != null) {
          const requestSummary = normalized[requestSummaryIndex];
          const existingClarificationItems = ((requestSummary.metadata?.clarificationItems || []) as any[]);
          const mergedClarificationItems = [...existingClarificationItems, ...clarificationItems].filter((item, index, items) =>
            items.findIndex(candidate => candidate.question === item.question && candidate.answer === item.answer) === index
          );
          normalized[requestSummaryIndex] = {
            ...requestSummary,
            metadata: {
              ...(requestSummary.metadata || {}),
              clarificationItems: mergedClarificationItems,
              clarificationCount: mergedClarificationItems.length,
              clarificationSummary: nextMessage.content,
            },
          };
        } else {
          normalized.push({
            ...nextMessage,
            type: 'request_summary',
            content: this.stateSubject.value?.resolvedSystemName || this.stateSubject.value?.architectureRequest?.prompt || nextMessage.content,
            metadata: {
              ...(nextMessage.metadata || {}),
              clarificationItems,
              clarificationCount: clarificationItems.length,
              clarificationSummary: nextMessage.content,
            },
          });
        }
        continue;
      }

      normalized.push({
        ...nextMessage,
        metadata: nextMessage.type === 'request_summary'
          ? {
              ...(nextMessage.metadata || {}),
              clarificationItems: ((nextMessage.metadata?.clarificationItems || []) as any[]),
            }
          : nextMessage.metadata,
      });
    }

    return normalized;
  }

  private mergeChatMessages(existing: ChatPresentationMessage[], incoming: ChatPresentationMessage[]): ChatPresentationMessage[] {
    const preserved = existing.filter(msg => msg.id !== this.streamingAssistantMessageId);
    if (!incoming.length) {
      return this.normalizePresentationMessages(preserved);
    }

    const merged = [...preserved];
    const seen = new Set(merged.map(msg => msg.id));

    for (const msg of incoming) {
      const normalized = {
        ...msg,
        id: msg.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      };
      if (normalized.type === 'request_summary') {
        const requestSummaryIndex = merged.findIndex(existingMsg => existingMsg.type === 'request_summary');
        if (requestSummaryIndex >= 0) {
          // MERGE, don't replace. The intake-built request_summary carries
          // the original prompt + clarification Q&A in its metadata; the
          // composition's backend summary does NOT (it only has counts +
          // diagramType). A blind replace here erased the user's prompt and
          // Q&A from the thread the moment compose finished. Keep the
          // existing content + rich metadata, overlay the backend's extras.
          const existingMsg = merged[requestSummaryIndex];
          merged[requestSummaryIndex] = {
            ...normalized,
            content: existingMsg.content || normalized.content,
            metadata: {
              ...(normalized.metadata || {}),     // backend extras (nodeCount, …)
              ...(existingMsg.metadata || {}),     // intake fields WIN (originalPrompt, clarificationItems)
            },
          };
          seen.add(normalized.id);
          // Keep the stable intake id so future upserts still match.
          merged[requestSummaryIndex].id = existingMsg.id || normalized.id;
          continue;
        }
      }
      if (seen.has(normalized.id)) {
        const idx = merged.findIndex(existingMsg => existingMsg.id === normalized.id);
        if (idx >= 0) {
          merged[idx] = normalized;
        }
      } else {
        merged.push(normalized);
        seen.add(normalized.id);
      }
    }

    return this.normalizePresentationMessages(merged);
  }
}
