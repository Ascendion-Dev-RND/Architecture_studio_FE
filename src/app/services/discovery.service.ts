import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { WorkflowJobService, WorkspaceJobUpdate } from './workflow-job.service';

/**
 * Gap detected in requirements analysis
 */
export interface DiscoveryGap {
  dimension: string;
  severity: string;
  description: string;
}

/**
 * Clarification question from Requirements Analyzer
 */
export interface DiscoveryQuestion {
  id: string;
  question: string;
  dimension: string;
  options: string[];
  required: boolean;
  responseType?: 'radio' | 'multiselect';  // radio = single select, multiselect = pick multiple
}

/**
 * Technical approach summary
 */
export interface TechnicalApproach {
  summary: string;
  style: string;
  keyTechnologies: string[];
  estimatedComplexity: string;
}

/**
 * Clarification answer submitted to /discovery/clarify
 */
export interface ClarificationAnswerPayload {
  questionId: string;
  question: string;
  answer: string;
}

/**
 * Response from /api/v1/discovery/analyze
 * Now includes intakeArtifactId (persisted) and askSummary for the stateful flow.
 */
export interface AnalyzeResponse {
  confidence: number;
  canProceed: boolean;
  status: string;                // "ready" | "clarification_required"
  intakeArtifactId: string;      // persisted artifact ID for subsequent calls
  askSummary: string;            // short summary for FE/chat
  gaps: DiscoveryGap[];
  questions: DiscoveryQuestion[];
  technicalApproach?: TechnicalApproach;
}

/**
 * Response from /api/v1/discovery/clarify
 * Artifact-first: loads persisted intake, merges answers, returns updated readiness.
 */
export interface ClarifyResponse {
  confidence: number;
  canProceed: boolean;
  status: string;                       // "ready" | "clarification_required"
  intakeArtifactId: string;             // updated artifact ID
  askSummary: string;                   // clean project title / short summary for FE handoff
  remainingQuestions: DiscoveryQuestion[]; // remaining blocking questions (if any)
}

/**
 * Stateful Discovery Service
 *
 * Flow: analyze → clarify (loop) → ready → generate-composition
 *
 * /analyze persists an intake artifact and returns intakeArtifactId + questions.
 * /clarify loads persisted intake, merges answers, returns updated readiness.
 * Classification happens internally inside analyze (not a separate public API).
 */
@Injectable({
  providedIn: 'root'
})
export class DiscoveryService {
  private readonly baseUrl = (environment.api as any).architectureServiceUrl || environment.api.backendUrl || '';

  constructor(private http: HttpClient, private workflowJobService: WorkflowJobService) {
    console.log('[DiscoveryService] Initialized with baseUrl:', this.baseUrl || '(relative/proxy)');
  }

  analyzePromptJob(prompt: string, workspaceId: string, feature: string = 'workbench',
                   diagramType?: string, attachedDocuments?: any[]): Observable<WorkspaceJobUpdate<AnalyzeResponse>> {
    const body: any = {
      prompt,
      workspaceId,
      feature,
      diagramType: diagramType || 'autodetect',
    };
    if (attachedDocuments && attachedDocuments.length > 0) {
      body.attachedDocuments = attachedDocuments;
    }
    return this.workflowJobService.runJob<AnalyzeResponse>('/api/v1/discovery/jobs/analyze', body);
  }

  /**
   * Analyze a user prompt — classifies internally, runs RAG, persists intake artifact.
   * Returns intakeArtifactId, questions, askSummary, status.
   */
  analyzePrompt(prompt: string, workspaceId: string, feature: string = 'workbench',
                diagramType?: string, attachedDocuments?: any[]): Observable<AnalyzeResponse> {
    const url = `${this.baseUrl}/api/v1/discovery/analyze`;

    const body: any = {
      prompt,
      workspaceId,
      feature,
      diagramType: diagramType || 'autodetect',
    };
    if (attachedDocuments && attachedDocuments.length > 0) {
      body.attachedDocuments = attachedDocuments;
    }

    return this.http.post<AnalyzeResponse>(url, body).pipe(
      timeout(300000)  // 5 minutes for local LLM support
    );
  }

  /**
   * Submit clarification answers — loads persisted intake, merges answers, returns updated readiness.
   * Artifact-first: takes intakeArtifactId + structured answers (not enriched prompt).
   */
  submitClarifications(
    intakeArtifactId: string,
    workspaceId: string,
    answers: ClarificationAnswerPayload[]
  ): Observable<ClarifyResponse> {
    const url = `${this.baseUrl}/api/v1/discovery/clarify`;

    console.log('[DiscoveryService] Submitting clarifications:', answers.length, 'answers for intake:', intakeArtifactId, 'ws:', workspaceId);

    return this.http.post<ClarifyResponse>(url, {
      intakeArtifactId,
      workspaceId,
      answers,
    }).pipe(
      timeout(300000)  // 5 minutes for local LLM support
    );
  }

  submitClarificationsJob(
    intakeArtifactId: string,
    workspaceId: string,
    answers: ClarificationAnswerPayload[]
  ): Observable<WorkspaceJobUpdate<ClarifyResponse>> {
    return this.workflowJobService.runJob<ClarifyResponse>('/api/v1/discovery/jobs/clarify', {
      intakeArtifactId,
      workspaceId,
      answers,
    });
  }
}
