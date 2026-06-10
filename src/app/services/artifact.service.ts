import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, timeout, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Attachment } from '../models/attachment.model';

// ── Interfaces ───────────────────────────────────────────────────────────

export interface ArtifactType {
  id: string;
  label: string;
  description: string;
  requiresClarification: boolean;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  category: string;
  options: string[];
  required: boolean;
  allowFreeText: boolean;
  allowMultiple: boolean;
  artifactType: string;
}

export interface ClarifyResponse {
  sufficiency: number;
  canSkip: boolean;
  questions: ClarificationQuestion[];
  clarificationAnswers?: { questionId: string; question: string; answer: string }[];
  artifactRequests?: ArtifactRequestSummary[];
}

export interface ArtifactRequestSummary {
  artifactType: string;
  artifactRequestId: string;
  status: string;
}

export interface ArtifactSection {
  id: string;
  title: string;
  order: number;
  type: 'markdown' | 'table' | 'checklist' | 'yaml' | 'json';
  content: any;
  status: string;
  confidence: number;
  references: any[];
  actions: string[];
}

export interface ArtifactDoc {
  artifactId: string;
  artifactType: string;
  title: string;
  status: string;
  sections: ArtifactSection[];
  assumptions: string[];
  openQuestions: string[];
  workspaceId?: string;
  projectId?: string;
  artifactRequestId?: string;
  rootArtifactId?: string;
  priorVersionArtifactId?: string;
  sourceReferences?: any[];
  exportPayload?: any;
  metadata: { version: number; inputsHash: string };
}

export interface ArtifactPackDoc {
  packId: string;
  artifacts: ArtifactDoc[];
  referencesUsed: any[];
  metadata: { createdAt: string; version: number; artifactTypes: string[] };
}

export interface RefineResponse {
  updatedSections: { id: string; title: string; content: any; status: string; confidence: number }[];
  deltaNotes: string;
  newVersion: number;
  artifact?: ArtifactDoc;
}

export interface ExportResponse {
  content: string;
  filename: string;
  contentType: string;
}

export interface ArtifactReference {
  id: string;
  type: 'blueprint' | 'workbench' | 'artifact';
  name: string;
  projectId?: string;
  workspaceId?: string;
  date?: string;
}

export interface ArtifactWorkflowOptions {
  workspaceId?: string;
  projectId?: string;
  projectName?: string;
  context?: string;
  references?: ArtifactReference[];
  attachments?: Attachment[];
  artifactRequests?: ArtifactRequestSummary[];
}

export interface ArtifactWorkspaceArtifacts {
  workspaceId: string;
  latestRequest?: any;
  requestArtifacts: any[];
  latestGeneratedArtifact?: ArtifactDoc | null;
  generatedArtifacts: ArtifactDoc[];
  summary?: any;
}

// ── Service ──────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class ArtifactService {
  private readonly baseUrl: string;

  constructor(private http: HttpClient) {
    const archUrl = (environment.api as any).architectureServiceUrl;
    this.baseUrl = archUrl === '' ? '/arch' : (archUrl || 'http://localhost:8084');
    console.log('[ArtifactService] baseUrl:', this.baseUrl);
  }

  /**
   * List all supported artifact types.
   */
  listTypes(): Observable<ArtifactType[]> {
    return this.http.get<{ types: ArtifactType[] }>(`${this.baseUrl}/api/v1/artifacts/types`).pipe(
      timeout(10000),
      map(r => r.types),
      catchError(() => of(this.getDefaultTypes()))
    );
  }

  /**
   * Analyze prompt and return clarification questions.
   */
  clarify(
    prompt: string,
    artifactTypes: string[],
    options: ArtifactWorkflowOptions = {}
  ): Observable<ClarifyResponse> {
    const body = {
      prompt,
      artifactTypes,
      workspaceId: this.resolveWorkspaceId(options),
      projectId: this.resolveProjectId(options),
      projectName: this.resolveProjectName(options),
      context: options.context,
      references: options.references,
      attachments: this.toAttachmentPayloads(options.attachments)
    };
    return this.http.post<ClarifyResponse>(`${this.baseUrl}/api/v1/artifacts/clarify`, body).pipe(
      timeout(90000),
      catchError(err => throwError(() => new Error(this.extractErrorMessage(err, 'Artifact clarification failed'))))
    );
  }

  /**
   * Generate artifacts from prompt + clarifications.
   */
  generate(
    prompt: string,
    artifactTypes: string[],
    clarifications?: Record<string, string>,
    options: ArtifactWorkflowOptions = {}
  ): Observable<ArtifactPackDoc> {
    const body = {
      prompt,
      artifactTypes,
      clarifications,
      workspaceId: this.resolveWorkspaceId(options),
      projectId: this.resolveProjectId(options),
      projectName: this.resolveProjectName(options),
      context: options.context,
      references: options.references,
      attachments: this.toAttachmentPayloads(options.attachments),
      artifactRequests: options.artifactRequests,
    };
    return this.http.post<ArtifactPackDoc>(`${this.baseUrl}/api/v1/artifacts/generate`, body).pipe(
      timeout(180000),
      map(pack => this.normalizeArtifactPack(pack as any, artifactTypes)),
      catchError(err => throwError(() => new Error(this.extractErrorMessage(err, 'Artifact generation failed'))))
    );
  }

  /**
   * Refine artifact sections via chat instruction.
   */
  refine(
    artifact: ArtifactDoc,
    instruction: string,
    sectionIds?: string[],
    options: ArtifactWorkflowOptions = {}
  ): Observable<RefineResponse> {
    const body = {
      artifact,
      instruction,
      sectionIds,
      workspaceId: options.workspaceId || artifact.workspaceId || this.resolveWorkspaceId(options),
      projectId: options.projectId || artifact.projectId || this.resolveProjectId(options)
    };
    return this.http.post<RefineResponse>(`${this.baseUrl}/api/v1/artifacts/refine`, body).pipe(
      timeout(60000),
      map(response => this.normalizeRefineResponse(response as any)),
      catchError(() => of({ updatedSections: [], deltaNotes: 'Refinement failed', newVersion: artifact.metadata?.version || 0 }))
    );
  }

  /**
   * Export artifact to specified format.
   */
  export(artifact: ArtifactDoc, format: string = 'markdown'): Observable<ExportResponse> {
    const body = { artifact, artifactId: artifact.artifactId, format };
    return this.http.post<ExportResponse>(`${this.baseUrl}/api/v1/artifacts/export`, body).pipe(
      timeout(30000),
      catchError(() => of({ content: '', filename: 'export-failed.md', contentType: 'text/markdown' }))
    );
  }

  listWorkspaceArtifacts(workspaceId: string): Observable<ArtifactWorkspaceArtifacts> {
    return this.http.get<ArtifactWorkspaceArtifacts>(`${this.baseUrl}/api/v1/artifacts/workspace/${workspaceId}`).pipe(
      timeout(30000),
      map(payload => this.normalizeWorkspaceArtifacts(payload as any, workspaceId)),
      catchError(() => of({
        workspaceId,
        requestArtifacts: [],
        generatedArtifacts: [],
        latestGeneratedArtifact: null
      }))
    );
  }

  getArtifact(artifactId: string): Observable<ArtifactDoc | null> {
    return this.http.get<any>(`${this.baseUrl}/api/v1/artifacts/${artifactId}`).pipe(
      timeout(20000),
      map(payload => payload && payload.sections ? this.normalizeArtifact(payload) : null),
      catchError(() => of(null))
    );
  }

  private getDefaultTypes(): ArtifactType[] {
    return [
      { id: 'ARD', label: 'Architecture Requirements Document', description: 'Requirements-driven architecture artifact', requiresClarification: true },
      { id: 'HLD', label: 'High-Level Design', description: 'System structure, boundaries, integrations, and key decisions', requiresClarification: true },
      { id: 'LLD', label: 'Low-Level Design', description: 'Detailed technical design for implementation teams', requiresClarification: true },
      { id: 'OPENAPI', label: 'OpenAPI Specification', description: 'OpenAPI 3.x API contract', requiresClarification: true },
      { id: 'ADR', label: 'Architecture Decision Record', description: 'Structured decision record with rationale and consequences', requiresClarification: true },
      { id: 'OTHER', label: 'Other Technical Artifact', description: 'General-purpose architecture or technical artifact', requiresClarification: true },
    ];
  }

  private normalizeWorkspaceArtifacts(payload: any, workspaceId: string): ArtifactWorkspaceArtifacts {
    return {
      workspaceId,
      latestRequest: payload?.latestRequest,
      requestArtifacts: Array.isArray(payload?.requestArtifacts) ? payload.requestArtifacts : [],
      latestGeneratedArtifact: payload?.latestGeneratedArtifact ? this.normalizeArtifact(payload.latestGeneratedArtifact) : null,
      generatedArtifacts: Array.isArray(payload?.generatedArtifacts)
        ? payload.generatedArtifacts.map((artifact: any) => this.normalizeArtifact(artifact))
        : [],
      summary: payload?.summary
    };
  }

  private normalizeArtifactPack(pack: any, artifactTypes: string[]): ArtifactPackDoc {
    const artifacts = Array.isArray(pack?.artifacts)
      ? pack.artifacts.map((artifact: any) => this.normalizeArtifact(artifact))
      : [];
    return {
      packId: typeof pack?.packId === 'string' && pack.packId ? pack.packId : `pack-${Date.now()}`,
      artifacts,
      referencesUsed: Array.isArray(pack?.referencesUsed) ? pack.referencesUsed : [],
      metadata: {
        createdAt: typeof pack?.metadata?.createdAt === 'string' ? pack.metadata.createdAt : new Date().toISOString(),
        version: typeof pack?.metadata?.version === 'number' ? pack.metadata.version : 1,
        artifactTypes: Array.isArray(pack?.metadata?.artifactTypes) ? pack.metadata.artifactTypes : artifactTypes,
      },
    };
  }

  private normalizeArtifact(raw: any): ArtifactDoc {
    const sections = Array.isArray(raw?.sections)
      ? raw.sections.map((section: any, index: number) => ({
          id: typeof section?.id === 'string' && section.id ? section.id : `section-${index + 1}`,
          title: typeof section?.title === 'string' ? section.title : `Section ${index + 1}`,
          order: typeof section?.order === 'number' ? section.order : index + 1,
          type: this.normalizeSectionType(section?.type),
          content: section?.content ?? '',
          status: typeof section?.status === 'string' ? section.status : 'draft',
          confidence: typeof section?.confidence === 'number' ? section.confidence : 0.7,
          references: Array.isArray(section?.references) ? section.references : [],
          actions: Array.isArray(section?.actions) ? section.actions : [],
        }))
      : [];

    return {
      artifactId: typeof raw?.artifactId === 'string' ? raw.artifactId : '',
      artifactType: typeof raw?.artifactType === 'string' ? raw.artifactType : 'OTHER',
      title: typeof raw?.title === 'string' && raw.title ? raw.title : 'Artifact',
      status: typeof raw?.status === 'string' ? raw.status : 'draft',
      sections,
      assumptions: Array.isArray(raw?.assumptions) ? raw.assumptions : [],
      openQuestions: Array.isArray(raw?.openQuestions) ? raw.openQuestions : [],
      workspaceId: typeof raw?.workspaceId === 'string' ? raw.workspaceId : '',
      projectId: typeof raw?.projectId === 'string' ? raw.projectId : '',
      artifactRequestId: typeof raw?.artifactRequestId === 'string' ? raw.artifactRequestId : '',
      rootArtifactId: typeof raw?.rootArtifactId === 'string' ? raw.rootArtifactId : '',
      priorVersionArtifactId: typeof raw?.priorVersionArtifactId === 'string' ? raw.priorVersionArtifactId : '',
      sourceReferences: Array.isArray(raw?.sourceReferences) ? raw.sourceReferences : [],
      exportPayload: raw?.exportPayload || {},
      metadata: {
        version: typeof raw?.metadata?.version === 'number'
          ? raw.metadata.version
          : (typeof raw?.version === 'number' ? raw.version : 1),
        inputsHash: typeof raw?.metadata?.inputsHash === 'string' ? raw.metadata.inputsHash : '',
      },
    };
  }

  private normalizeRefineResponse(response: any): RefineResponse {
    const artifact = response?.artifact ? this.normalizeArtifact(response.artifact) : undefined;
    const updatedSections = Array.isArray(response?.updatedSections)
      ? response.updatedSections.map((section: any, index: number) => ({
          id: typeof section?.id === 'string' && section.id ? section.id : `section-${index + 1}`,
          title: typeof section?.title === 'string' ? section.title : `Section ${index + 1}`,
          content: section?.content ?? '',
          status: typeof section?.status === 'string' ? section.status : 'draft',
          confidence: typeof section?.confidence === 'number' ? section.confidence : 0.7,
        }))
      : [];

    return {
      updatedSections,
      deltaNotes: typeof response?.deltaNotes === 'string' ? response.deltaNotes : 'Artifact updated',
      newVersion: typeof response?.newVersion === 'number'
        ? response.newVersion
        : (artifact?.metadata?.version || 1),
      artifact,
    };
  }

  private normalizeSectionType(type: any): 'markdown' | 'table' | 'checklist' | 'yaml' | 'json' {
    if (type === 'table' || type === 'checklist' || type === 'yaml' || type === 'json') {
      return type;
    }
    return 'markdown';
  }

  private extractErrorMessage(err: any, fallback: string): string {
    const detail = err?.error?.detail || err?.error?.message || err?.message;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    return fallback;
  }

  private toAttachmentPayloads(attachments?: Attachment[]): Array<Record<string, string>> | undefined {
    if (!attachments || attachments.length === 0) {
      return undefined;
    }
    return attachments.map(attachment => ({
      id: attachment.id,
      type: attachment.type === 'image' ? 'image' : 'document',
      filename: attachment.name,
      mimeType: attachment.mimeType || '',
      summary: attachment.name,
      extractedText: attachment.metadata?.extractedText || (attachment.type !== 'image' ? (attachment.content || '') : ''),
      storageRef: attachment.url || '',
    }));
  }

  private resolveWorkspaceId(options: ArtifactWorkflowOptions): string {
    return options.workspaceId
      || options.references?.[0]?.workspaceId
      || options.projectId
      || options.references?.[0]?.projectId
      || options.references?.[0]?.id
      || '';
  }

  private resolveProjectId(options: ArtifactWorkflowOptions): string {
    return options.projectId
      || options.references?.[0]?.projectId
      || options.references?.[0]?.id
      || '';
  }

  private resolveProjectName(options: ArtifactWorkflowOptions): string {
    return options.projectName || options.references?.[0]?.name || '';
  }
}
