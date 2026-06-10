import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, timer, throwError, of, Subject } from 'rxjs';
import { switchMap, takeWhile, catchError, map, timeout, take, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Streaming event interface for chat
export interface ChatStreamEvent {
  type: 'thinking' | 'text' | 'complete' | 'error';
  message?: string;
  content?: string;
  response?: string;
  suggestedDiagram?: string;
  diagramType?: string;
  changes?: any;
}

/**
 * Diagram Type Interface
 */
export interface PresetInfo {
  value: string;   // e.g. "aws", "azure", "gcp", "hybrid", "generic"
  label: string;   // e.g. "AWS Cloud Architecture"
  icon: string;    // Lucide icon name
}

export interface DiagramType {
  value: string;
  label: string;
  description: string;
  icon: string;
  canvasType: 'maxgraph' | 'mermaid';
  presets?: PresetInfo[] | null;  // null = no secondary dropdown
}

/**
 * Architecture Generation Request
 */
export interface ArchitectureGenerateRequest {
  prompt: string;
  diagramType?: string;
  preset?: string;            // e.g. "aws", "azure", "gcp", "hybrid", "generic"
  workspaceId?: string;
  context?: string;
  cloudProvider?: string;
  clarifications?: Record<string, any>;
  attachedDocuments?: string[];
}

/**
 * Architecture Generation Response
 */
export interface ArchitectureGenerateResponse {
  taskId: string;
  status: string;
  message: string;
  workspaceId?: string;
  estimatedTime?: number;
}

/**
 * Task Status Response
 */
export interface TaskStatusResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: DiagramResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Diagram Result
 */
export interface DiagramResult {
  diagramData: {
    type: string;
    code: string;
  };
  workspaceId: string;
  message: string;
}

/**
 * Chat Refinement Request
 */
export interface ChatRefinementRequest {
  workspaceId: string;
  message: string;
  currentDiagram?: string;
  diagramType?: string;
}

/**
 * Chat Refinement Response
 */
export interface ChatRefinementResponse {
  taskId: string;
  status: string;
  message: string;
}

/**
 * Architecture Service
 * 
 * Handles all architecture generation and refinement API calls
 */
@Injectable({
  providedIn: 'root'
})
export class ArchitectureService {
  private readonly baseUrl = (environment.api as any).architectureServiceUrl || environment.api.backendUrl || '';
  private readonly agentsUrl = (environment.api as any).agentServiceUrl || '';
  private readonly agentDiagramsBase = (() => {
    const agentUrl = (environment.api as any).agentServiceUrl || '';
    const diagramsPath = (environment.api as any).agentServiceEndpoints?.diagrams || '/api/v1/diagrams';
    // Always prepend agentServiceUrl to get absolute URL (fixes 405 when path is relative)
    return diagramsPath.startsWith('http') ? diagramsPath : `${agentUrl}${diagramsPath}`;
  })();
  private readonly pollingInterval = 2000; // 2 seconds
  private readonly maxPollingAttempts = 30; // Max 30 attempts = 60 seconds

  constructor(private http: HttpClient, private ngZone: NgZone) {
    console.log('[ArchitectureService] Initialized with baseUrl:', this.baseUrl || '(relative/proxy)');
  }

  /**
   * Generate architecture diagram
   * Returns an observable that emits task updates until completion.
   */
  generateArchitecture(request: ArchitectureGenerateRequest): Observable<TaskStatusResponse> {
    const url = `${this.baseUrl}/api/v1/architecture/generate`;
    
    return this.http.post<ArchitectureGenerateResponse>(url, request).pipe(
      timeout(30000),
      switchMap(response => this.pollTaskStatus(response.taskId))
    );
  }

  /**
   * Poll task status until completion or failure (with retry limit)
   */
  pollTaskStatus(taskId: string): Observable<TaskStatusResponse> {
    const url = `${this.baseUrl}/api/v1/architecture/tasks/${taskId}`;
    let attempts = 0;

    return timer(0, this.pollingInterval).pipe(
      take(this.maxPollingAttempts),
      switchMap(() => {
        attempts++;
        console.log(`[ArchitectureService] Polling attempt ${attempts}/${this.maxPollingAttempts}`);
        return this.http.get<TaskStatusResponse>(url).pipe(
          timeout(10000),
          catchError(err => {
            console.error(`[ArchitectureService] Poll error:`, err);
            // Return a failed status on error
            return of({
              taskId,
              status: 'failed' as const,
              progress: 0,
              error: 'Failed to get task status',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          })
        );
      }),
      takeWhile(response => {
        const isComplete = response.status === 'completed' || response.status === 'failed';
        const isMaxAttempts = attempts >= this.maxPollingAttempts;
        if (isMaxAttempts && !isComplete) {
          console.warn('[ArchitectureService] Max polling attempts reached');
        }
        return !isComplete && !isMaxAttempts;
      }, true)
    );
  }

  /**
   * Get available diagram types
   */
  getDiagramTypes(): Observable<DiagramType[]> {
    const url = `${this.baseUrl}/api/v1/architecture/diagram-types`;
    
    return this.http.get<{ diagramTypes: DiagramType[] }>(url).pipe(
      map(response => response.diagramTypes),
      catchError(error => {
        console.error('Failed to fetch diagram types:', error);
        return throwError(() => new Error('Failed to load diagram types. Please check your connection and try again.'));
      })
    );
  }

  /**
   * Refine diagram via chat
   */
  refineDiagram(request: ChatRefinementRequest): Observable<TaskStatusResponse> {
    const url = `${this.baseUrl}/api/v1/architecture/refine`;
    
    return this.http.post<ChatRefinementResponse>(url, request).pipe(
      switchMap(response => this.pollTaskStatus(response.taskId)),
      catchError(error => {
        console.error('Diagram refinement error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Direct chat with AI for diagram suggestions
   */
  chatWithAI(
    workspaceId: string, 
    message: string, 
    currentDiagram?: string,
    currentDiagramSpec?: any
  ): Observable<{
    response: string;
    suggestedDiagram?: string;
    diagramType?: string;
    changes?: any;
  }> {
    const url = `${this.baseUrl}/api/v1/architecture/chat`;
    
    const requestBody: any = {
      workspaceId,
      message,
      currentDiagram
    };
    
    // Add DiagramSpec for cloud architecture
    if (currentDiagramSpec) {
      requestBody.currentDiagramSpec = currentDiagramSpec;
      requestBody.diagramType = 'cloud-architecture';
    }
    
    return this.http.post<any>(url, requestBody).pipe(
      timeout(60000),
      catchError(error => {
        console.error('Chat error:', error);
        return throwError(() => new Error('Chat service unavailable. Please try again later.'));
      })
    );
  }

  /**
   * Stream chat with AI for diagram suggestions via SSE
   */
  chatWithAIStream(
    workspaceId: string, 
    message: string, 
    currentDiagram?: string,
    currentDiagramSpec?: any
  ): Observable<ChatStreamEvent> {
    const subject = new Subject<ChatStreamEvent>();
    const url = `${this.agentDiagramsBase}/chat-stream`;
    
    console.log('[ArchitectureService] Starting chat stream:', url);
    
    const requestBody: any = {
      workspaceId,
      message,
      currentDiagram
    };
    
    if (currentDiagramSpec) {
      requestBody.currentDiagramSpec = currentDiagramSpec;
      requestBody.diagramType = 'cloud-architecture';
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
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
          console.log('[ArchitectureService] Chat stream complete');
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
              console.log('[ArchitectureService] Chat stream event:', data.type);
              this.ngZone.run(() => subject.next(data as ChatStreamEvent));
            } catch (e) {
              console.warn('[ArchitectureService] Failed to parse chat SSE data:', line);
            }
          }
        }
        
        return reader.read().then(processChunk);
      };
      
      reader.read().then(processChunk);
    }).catch(error => {
      console.error('[ArchitectureService] Chat stream error:', error);
      this.ngZone.run(() => {
        subject.next({ type: 'error', message: error.message });
        subject.complete();
      });
    });

    return subject.asObservable();
  }

  /**
   * Parse Diagram-as-Code DSL into DiagramSpec JSON
   */
  parseDiagramAsCode(code: string): Observable<{ diagramSpec: any; canvasType: string; diagramType: string }> {
    const url = `${this.agentDiagramsBase}/parse-dac`;
    return this.http.post<{ diagramSpec: any; canvasType: string; diagramType: string }>(url, { code }).pipe(
      timeout(30000),
      catchError(error => {
        console.error('DAC parse error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Fetch (or generate) the lazy "Explain this architecture" overview for a
   * v2 compose result. Calls
   * {@code POST /api/v1/architecture/diagrams/{workspaceId}/{diagramId}/overview}
   * — server caches the result keyed by (workspaceId, diagramId, version),
   * so subsequent clicks are instant.
   *
   * <p>The body carries the original prompt + cloud provider so the
   * narrator can produce a richer summary without re-reading the diagram
   * graph itself.
   */
  fetchOverview(
      workspaceId: string,
      diagramId: string,
      body: { prompt?: string; cloudProvider?: string; version?: any;
              requirementUnderstanding?: any; architecturePlan?: any } = {}
  ): Observable<any> {
    const url = `${this.baseUrl}/api/v1/architecture/diagrams/${encodeURIComponent(workspaceId)}/${encodeURIComponent(diagramId)}/overview`;
    return this.http.post<any>(url, body).pipe(
        timeout(60_000),
        catchError(error => {
          console.error('[ArchitectureService] fetchOverview failed', error);
          return throwError(() => error);
        }),
    );
  }

  /**
   * Convert DiagramSpec JSON back to Diagram-as-Code DSL text
   */
  reverseDiagramToCode(diagramSpec: any): Observable<{ code: string }> {
    const url = `${this.agentDiagramsBase}/reverse-dac`;
    return this.http.post<{ code: string }>(url, { diagramSpec }).pipe(
      timeout(30000),
      catchError(error => {
        console.error('DAC reverse error:', error);
        return throwError(() => error);
      })
    );
  }


  /**
   * Generate E2E System Design
   * Calls the backend API to generate comprehensive system design
   */
  generateE2EDesign(prompt: string, context?: string, attachments?: any[]): Observable<E2EDesignResponse> {
    const url = `${this.baseUrl}/api/v1/e2e-design/generate`;
    
    return this.http.post<E2EDesignResponse>(url, {
      prompt,
      context,
      attachments
    }).pipe(
      timeout(120000),
      catchError(error => {
        console.error('E2E design error:', error);
        return throwError(() => new Error('Failed to generate E2E design'));
      })
    );
  }
}

/**
 * E2E Design Response Interface
 */
export interface E2EDesignResponse {
  success: boolean;
  systemName: string;
  overview: string;
  designPoints: string[];
  architectureDescription: string;
  architectureDiagram: string;
  sequenceDiagram: string;
  erDiagram: string;
  cloudArchitectureDiagramSpec?: any;  // DiagramSpec JSON for cloud architecture
  cloudArchitectureDiagramXml?: string;  // Compiled draw.io XML
  diagramCompileWarnings?: any[];  // Compilation warnings
  apis: APIEndpoint[];
  databaseSchema: DatabaseTable[];
  devopsRecommendations: string[];
  deploymentDiagram: string;
  securityConsiderations: string[];
  scalabilityNotes: string[];
  techStack: { [key: string]: string[] };
}

export interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
}

export interface DatabaseTable {
  name: string;
  description: string;
  columns: { name: string; type: string; constraints: string }[];
  relationships?: string[];
}
