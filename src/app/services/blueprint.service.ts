import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of, Subject } from 'rxjs';
import { catchError, timeout, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ── Streaming Event Types ─────────────────────────────────────────────────

export interface StreamEvent {
  type: 'init' | 'section' | 'complete' | 'thinking' | 'text' | 'error';
  blueprint?: Blueprint;
  section?: BlueprintSection;
  index?: number;
  total?: number;
  message?: string;
  deltaNotes?: string;
  updatedCount?: number;
}

// ── Interfaces ───────────────────────────────────────────────────────────

export interface ClarificationQuestion {
  id: string;
  question: string;
  dimension: string;
  options: string[];
  required: boolean;
  allowFreeText: boolean;
}

export interface ClarifyResponse {
  mode: 'greenfield' | 'brownfield';
  sufficiency: number;
  canSkip: boolean;
  questions: ClarificationQuestion[];
}

export interface BlueprintSection {
  id: string;
  title: string;
  icon: string;
  order: number;
  status: 'draft' | 'finalized';
  contentType: 'prose' | 'table' | 'list' | 'diagram' | 'key-value' | 'mixed';
  content: any;
  collapsed: boolean;
}

export interface Blueprint {
  id: string;
  version: number;
  mode: 'greenfield' | 'brownfield';
  systemName: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  sections: BlueprintSection[];
}

export interface RefineResponse {
  updatedSections: { id: string; title: string; content: any; status: string }[];
  deltaNotes: string;
}

export interface ExportResponse {
  markdown: string;
  filename: string;
}

// ── Solution composition (FLOW 2) ──────────────────────────────────────────

export interface BlueprintDiagramRef {
  viewKey: string;
  viewType: string;
  title: string;
  provider: string;
  diagramFamily: string;
  status: 'pending' | 'running' | 'ready' | 'failed';
  diagramId: string;
  confidence?: number;
  warnings?: string[];
  error?: string;
}

export interface BlueprintNarrativeSection {
  id: string;
  title: string;
  icon: string;
  order: number;
  status: string;
  contentType: string;
  content: any;
  sourcePageIds?: string[];
}

export interface SolutionBlueprint {
  blueprintId: string;
  projectId: string;
  workspaceId: string;
  intakeArtifactId?: string;
  systemName: string;
  domain: string;
  blueprintMode: string;
  provider?: string;
  narrativeSections: BlueprintNarrativeSection[];
  diagrams: BlueprintDiagramRef[];
  overallStatus: 'complete' | 'partial' | 'failed';
  chatMessages?: any[];
}

export interface ComposeResult {
  status: 'complete' | 'partial' | 'failed' | 'clarification_required';
  clarificationQuestions?: any[];
  blueprint?: SolutionBlueprint;
  viewContracts?: any[];
  error?: string;
}

// ── Service ──────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class BlueprintService {
  private readonly baseUrl: string;
  private readonly agentsUrl: string;

  constructor(private http: HttpClient, private ngZone: NgZone) {
    // In Docker, URLs are empty and we use nginx proxy paths
    const archUrl = (environment.api as any).architectureServiceUrl;
    const agentUrl = (environment.api as any).agentServiceUrl;
    
    // Use /arch proxy path if architectureServiceUrl is empty (Docker), otherwise use the URL directly
    this.baseUrl = archUrl === '' ? '/arch' : (archUrl || 'http://localhost:8084');
    this.agentsUrl = agentUrl === '' ? '/agents' : (agentUrl || 'http://localhost:8001');
    
    console.log('[BlueprintService] Initialized with baseUrl:', this.baseUrl);
    console.log('[BlueprintService] Fallback agentsUrl:', this.agentsUrl);
  }

  /**
   * Analyze prompt and generate clarification questions.
   */
  clarify(
    prompt: string,
    context?: string,
    mode?: string,
    attachedFileNames?: string[]
  ): Observable<ClarifyResponse> {
    const url = `${this.baseUrl}/api/v1/blueprint/clarify`;
    console.log('[BlueprintService] Calling clarify:', url);
    
    return this.http.post<ClarifyResponse>(url, {
      prompt,
      context: context || undefined,
      mode: mode || undefined,
      attachedFileNames: attachedFileNames || undefined,
    }).pipe(
      timeout(30000),
      map(response => {
        console.log('[BlueprintService] Clarify response:', response);
        return response;
      })
    );
  }

  /**
   * Generate a complete blueprint.
   */
  generate(
    prompt: string,
    mode: string,
    clarifications?: { [key: string]: string },
    context?: string
  ): Observable<Blueprint> {
    const url = `${this.baseUrl}/api/v1/blueprint/generate`;
    console.log('[BlueprintService] Calling generate:', url);
    
    return this.http.post<Blueprint>(url, {
      prompt,
      mode,
      clarifications: clarifications || undefined,
      context: context || undefined,
    }).pipe(
      timeout(120000),
      map(response => {
        console.log('[BlueprintService] Generate response received, sections:', response.sections?.length);
        return response;
      })
    );
  }

  /**
   * Refine specific blueprint sections via chat instruction (PATCH semantics).
   */
  refine(
    blueprint: Blueprint,
    instruction: string,
    sectionIds?: string[],
    clarifications?: { [key: string]: string }
  ): Observable<RefineResponse> {
    const url = `${this.baseUrl}/api/v1/blueprint/refine`;
    return this.http.post<RefineResponse>(url, {
      blueprint,
      instruction,
      sectionIds: sectionIds || undefined,
      clarifications: clarifications || undefined,
    }).pipe(
      timeout(60000)
    );
  }

  /**
   * Export blueprint to Markdown.
   */
  export(blueprint: Blueprint): Observable<ExportResponse> {
    const url = `${this.baseUrl}/api/v1/blueprint/export`;
    return this.http.post<ExportResponse>(url, { blueprint }).pipe(
      timeout(30000)
    );
  }

  /**
   * FLOW 2 — compose the full blueprint diagram set + narrative. Returns either
   * a clarification gate (status=clarification_required) or the composed
   * blueprint (with per-view diagramIds) + viewContracts.
   */
  composeBlueprint(
    intakeArtifact?: any,
    workspaceId?: string,
    answers?: any[],
    chatMessages?: any[]
  ): Observable<ComposeResult> {
    const url = `${this.baseUrl}/api/v1/blueprint/compose`;
    console.log('[BlueprintService] Calling compose:', url);
    return this.http.post<ComposeResult>(url, {
      intakeArtifact: intakeArtifact || undefined,
      workspaceId: workspaceId || undefined,
      answers: answers || undefined,
      chatMessages: chatMessages || undefined,
    }).pipe(timeout(300000));
  }

  /** Load a persisted solution blueprint by blueprintId. */
  getBlueprint(blueprintId: string): Observable<SolutionBlueprint> {
    const url = `${this.baseUrl}/api/v1/blueprint/${blueprintId}`;
    return this.http.get<SolutionBlueprint>(url).pipe(timeout(30000));
  }

  /** URL of a diagram's rendered SVG (gallery thumbnail + read view). */
  renderDiagramUrl(diagramId: string, workspaceId: string): string {
    return `${this.baseUrl}/api/architecture/diagrams/${diagramId}/svg`
      + `?workspaceId=${encodeURIComponent(workspaceId)}`;
  }

  /** Recent projects (blueprints appear here with metadata.kind=solution-blueprint). */
  listProjects(status: string = 'active'): Observable<any[]> {
    const url = `${this.baseUrl}/api/v1/projects?status=${encodeURIComponent(status)}`;
    return this.http.get<any[]>(url).pipe(timeout(30000), catchError(() => of([])));
  }

  // ── Streaming Methods (SSE) ─────────────────────────────────────────────

  /**
   * Stream blueprint generation section-by-section via SSE.
   * Returns an Observable that emits StreamEvent objects as sections are generated.
   */
  generateStream(
    prompt: string,
    mode: string,
    clarifications?: { [key: string]: string },
    context?: string
  ): Observable<StreamEvent> {
    const subject = new Subject<StreamEvent>();
    const url = `${this.baseUrl}/api/v1/blueprint/generate-stream`;
    
    console.log('[BlueprintService] Starting generate stream:', url);
    
    // Use fetch API for SSE since HttpClient doesn't handle it well
    const body = JSON.stringify({
      prompt,
      mode,
      clarifications: clarifications || undefined,
      context: context || undefined,
    });

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      const processChunk = (result: ReadableStreamReadResult<Uint8Array>): Promise<void> | void => {
        if (result.done) {
          console.log('[BlueprintService] Stream complete');
          this.ngZone.run(() => subject.complete());
          return;
        }
        
        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('[BlueprintService] Stream event:', data.type);
              this.ngZone.run(() => subject.next(data as StreamEvent));
            } catch (e) {
              console.warn('[BlueprintService] Failed to parse SSE data:', line);
            }
          }
        }
        
        return reader.read().then(processChunk);
      };
      
      reader.read().then(processChunk);
    }).catch(error => {
      console.error('[BlueprintService] Stream error:', error);
      this.ngZone.run(() => {
        subject.next({ type: 'error', message: error.message });
        subject.complete();
      });
    });

    return subject.asObservable();
  }

  /**
   * Stream section refinement via SSE for chat.
   * Returns an Observable that emits StreamEvent objects as sections are updated.
   */
  refineStream(
    blueprint: Blueprint,
    instruction: string,
    sectionIds?: string[],
    clarifications?: { [key: string]: string }
  ): Observable<StreamEvent> {
    const subject = new Subject<StreamEvent>();
    const url = `${this.baseUrl}/api/v1/blueprint/refine-stream`;
    
    console.log('[BlueprintService] Starting refine stream:', url);
    
    const body = JSON.stringify({
      blueprint,
      instruction,
      sectionIds: sectionIds || undefined,
      clarifications: clarifications || undefined,
    });

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      const processChunk = (result: ReadableStreamReadResult<Uint8Array>): Promise<void> | void => {
        if (result.done) {
          console.log('[BlueprintService] Refine stream complete');
          this.ngZone.run(() => subject.complete());
          return;
        }
        
        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('[BlueprintService] Refine stream event:', data.type);
              this.ngZone.run(() => subject.next(data as StreamEvent));
            } catch (e) {
              console.warn('[BlueprintService] Failed to parse refine SSE data:', line);
            }
          }
        }
        
        return reader.read().then(processChunk);
      };
      
      reader.read().then(processChunk);
    }).catch(error => {
      console.error('[BlueprintService] Refine stream error:', error);
      this.ngZone.run(() => {
        subject.next({ type: 'error', message: error.message });
        subject.complete();
      });
    });

    return subject.asObservable();
  }
}
