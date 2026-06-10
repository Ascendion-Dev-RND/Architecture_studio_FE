/**
 * DiagramComposeV2Service — thin HTTP client over the BFF compose endpoints
 * for the v2 diagram-service (LLD §B.6).
 *
 * <p>All FE component code calls these methods; the WebSocket layer is
 * handled separately by {@link DiagramStreamV2Service}.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface IntentGraphPayload {
  diagramId: string;
  workspaceId: string;
  viewType: string;
  provider: string;
  nodes: any[];
  edges: any[];
  boundaries?: any[];
  zones?: Record<string, any>;
  scenarios?: any[];
  budgets?: Record<string, any> | null;
}

export interface StyleProfileKey {
  provider: string;
  viewType: string;
  fidelity: 'low' | 'medium' | 'reference';
}

export interface CompileResponse {
  diagramId: string;
  version: number;
  patternId: string;
  svg: string;
  drawioXml: string;
  qualityReport?: any;
  traceId?: string;
  streamUrl?: string;
}

export interface EditResponse {
  addedEntityIds?: string[];
  removedEntityIds?: string[];
  moved?: any[];
  relabeled?: any[];
  restyledEntityIds?: string[];
  changedCallouts?: number[];
  streamUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class DiagramComposeV2Service {

  constructor(private readonly http: HttpClient) { }

  compile(intent: IntentGraphPayload, profileKey?: StyleProfileKey): Observable<CompileResponse> {
    return this.http.post<CompileResponse>(`${this.base()}/compile`, {
      intentGraph: intent,
      profileKey: profileKey ?? null,
      budgets: intent.budgets ?? null,
    });
  }

  regenerate(intent: IntentGraphPayload, profileKey?: StyleProfileKey): Observable<CompileResponse> {
    return this.http.post<CompileResponse>(`${this.base()}/regenerate`, {
      intentGraph: intent,
      profileKey: profileKey ?? null,
      budgets: intent.budgets ?? null,
    });
  }

  edit(workspaceId: string, diagramId: string,
       intentDelta: IntentGraphPayload, chatIntent?: string): Observable<EditResponse> {
    return this.http.post<EditResponse>(`${this.base()}/edit`, {
      workspaceId, diagramId, intentDelta,
      chatIntent: chatIntent ?? '',
    });
  }

  commit(workspaceId: string, diagramId: string, version: number): Observable<CompileResponse> {
    return this.http.post<CompileResponse>(`${this.base()}/commit`, {
      workspaceId, diagramId, version,
    });
  }

  overrides(workspaceId: string, diagramId: string,
            overrides: Record<string, any>): Observable<any> {
    return this.http.post(`${this.base()}/overrides`, {
      workspaceId, diagramId, overrides,
    });
  }

  health(): Observable<any> {
    return this.http.get(`${this.base()}/health`);
  }

  private base(): string {
    const v2: any = (environment.api as any).diagramServiceV2;
    return (v2 && v2.composeBase) || 'http://localhost:8084/api/v2/diagram';
  }
}
