import { Component, EventEmitter, Input, Output, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { DiscoveryService, AnalyzeResponse, ClarifyResponse, DiscoveryQuestion, ClarificationAnswerPayload } from '../../services/discovery.service';
import { Subscription } from 'rxjs';
import { WorkspaceJobEvent } from '../../services/workflow-job.service';

/**
 * User's answer to a clarification question
 */
export interface ClarificationAnswer {
  questionId: string;
  question: string;
  answer: string;
  /**
   * Kebab-case dimension identifier (e.g. "cloud-provider",
   * "data-sensitivity", "ha-posture"). Carried through to the
   * composition_analyst.synthesize_context task so it can index
   * answers by dimension without re-parsing the question text.
   * Empty string when the agent didn't tag the source question.
   */
  dimension?: string;
}

/**
 * Result emitted when discovery completes
 */
export interface DiscoveryResult {
  enrichedPrompt: string;
  answers: ClarificationAnswer[];
  confidence: number;
  canProceed: boolean;
  intakeArtifactId?: string;   // persisted intake artifact for artifact-first composition
  askSummary?: string;
}

interface AnalyzerProgressStep {
  stage: string;
  message: string;
  status: 'active' | 'completed';
}

/**
 * Requirements Analyzer Dialog Component
 * 
 * Implements the flow from the user's diagram:
 * User Prompt -> [Requirements Analyzer] -> Gap Analysis
 *   |                    |                    |
 * [Sufficient]    [Gaps Found]         [Ambiguous]
 *   |                    |                    |
 * Proceed       Ask structured        Ask open-ended
 *               questions             clarifications
 *                    |                    |
 *               User answers        User provides
 *                    |              more context
 *                    |                    |
 *               Re-analyze <--------------
 *                    |
 *              [All gaps filled]
 *                    |
 *             Proceed to generation
 * 
 * User responses are captured and shared in the workspace chat.
 */
@Component({
  selector: 'app-requirements-analyzer',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './requirements-analyzer.component.html',
  styleUrls: ['./requirements-analyzer.component.css']
})
export class RequirementsAnalyzerComponent implements OnInit, OnDestroy {
  @Input() prompt: string = '';
  @Input() feature: string = 'workbench';
  @Input() isOpen: boolean = false;
  @Input() diagramType?: string;
  @Input() preset?: string;
  @Input() cloudProvider?: string;
  @Input() attachedDocuments?: any[];
  @Input() preloadedQuestions?: any[];
  @Input({ required: true }) workspaceId!: string;  // mandatory — every discovery call must be workspace-scoped
  @Input() initialIntakeArtifactId?: string;  // from prior analyze call

  @Output() closed = new EventEmitter<void>();
  @Output() proceed = new EventEmitter<DiscoveryResult>();

  // State
  phase: 'analyzing' | 'questions' | 'reanalyzing' | 'ready' | 'error' = 'analyzing';
  confidence: number = 0;
  canProceed: boolean = false;
  questions: DiscoveryQuestion[] = [];
  answers: { [questionId: string]: string } = {};
  enrichedPrompt: string = '';
  errorMessage: string = '';
  analysisProgress: number = 0;
  intakeArtifactId: string = '';  // persisted by /discovery/analyze
  analysisStatusMessage: string = 'Analyzing your input';
  progressSteps: AnalyzerProgressStep[] = [];
  private activeJobSub?: Subscription;
  askSummary: string = '';

  constructor(private discoveryService: DiscoveryService) {}

  ngOnDestroy(): void {
    this.activeJobSub?.unsubscribe();
  }

  ngOnInit(): void {
    if (this.isOpen && this.prompt) {
      // If preloaded questions from intake, skip the analyze call
      if (this.preloadedQuestions && this.preloadedQuestions.length > 0) {
        this.questions = this.preloadedQuestions;
        this.phase = 'questions';
        this.confidence = 0.5;
        this.questions.forEach(q => {
          if (q.options && q.options.length > 0) {
            this.answers[q.id] = '';
          }
        });
        return;
      }
      this.startAnalysis();
    }
  }

  /**
   * Start requirements analysis when dialog opens
   */
  startAnalysis(): void {
    this.phase = 'analyzing';
    this.analysisProgress = 0;
    this.errorMessage = '';
    this.analysisStatusMessage = 'Analyzing your input';
    this.progressSteps = [];
    this.activeJobSub?.unsubscribe();
    this.activeJobSub = this.discoveryService.analyzePromptJob(
      this.prompt,
      this.workspaceId,
      this.feature,
      this.diagramType,
      this.attachedDocuments
    ).subscribe({
      next: update => {
        if (update.event) {
          this.applyJobEvent(update.event);
        }
        if (update.kind === 'completed' && update.result) {
          this.handleAnalyzeResponse(update.result);
        }
        if (update.kind === 'clarification_required' && update.result) {
          this.handleAnalyzeResponse(update.result);
        }
      },
      error: (error: any) => {
        console.error('[RequirementsAnalyzer] Analysis error:', error);
        this.phase = 'error';
        this.errorMessage = 'Failed to analyze requirements. You can proceed with the original prompt.';
      }
    });
  }

  /**
   * Submit answers and re-analyze
   */
  submitAnswers(): void {
    // Production-grade validation: required questions must have a value.
    // The agent's intake task flags high-severity gaps as required; the
    // user shouldn't be able to advance composition with those blank
    // (composition_analyst.synthesize_context will then have to ask
    // again, doubling the LLM cost).
    const missingRequired = (this.questions || []).filter(q => {
      if (!q.required) return false;
      const v = this.answers[q.id];
      return !v || !String(v).trim();
    });
    if (missingRequired.length > 0) {
      this.errorMessage = `Please answer ${missingRequired.length} required question${missingRequired.length === 1 ? '' : 's'} before continuing.`;
      // Scroll first missing into view if possible.
      const firstId = `q-${this.questions.indexOf(missingRequired[0])}`;
      const el = typeof document !== 'undefined' ? document.getElementById(firstId) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.errorMessage = '';

    // Filter out unanswered questions
    const answeredQuestions: { [key: string]: string } = {};
    Object.entries(this.answers).forEach(([key, value]) => {
      if (value && value.trim()) {
        answeredQuestions[key] = value;
      }
    });

    this.phase = 'reanalyzing';
    this.analysisProgress = 0;
    this.analysisStatusMessage = 'Re-analyzing with your answers';
    this.progressSteps = [];

    // If questions came from intake (preloaded), skip the discovery/clarify call
    // and proceed directly — answers will be sent to composition via the workspace component
    if (this.preloadedQuestions && this.preloadedQuestions.length > 0) {
      this.analysisProgress = 100;
      this.enrichedPrompt = this.buildEnrichedPrompt();
      this.confidence = 0.8;
      this.canProceed = true;
      setTimeout(() => this.proceedToWorkspace(), 300);
      return;
    }

    // Build structured answers for the artifact-first clarify endpoint
    const structuredAnswers: ClarificationAnswerPayload[] = Object.entries(answeredQuestions).map(([qId, ans]) => {
      const q = this.questions.find(qq => qq.id === qId);
      return { questionId: qId, question: q?.question || qId, answer: ans };
    });

    const resolvedIntakeId = this.intakeArtifactId || this.initialIntakeArtifactId || '';

    this.activeJobSub?.unsubscribe();
    this.activeJobSub = this.discoveryService.submitClarificationsJob(
      resolvedIntakeId,
      this.workspaceId,
      structuredAnswers
    ).subscribe({
      next: update => {
        if (update.event) {
          this.applyJobEvent(update.event);
        }
        if ((update.kind === 'completed' || update.kind === 'clarification_required') && update.result) {
          this.handleClarifyResponse(update.result);
        }
      },
      error: (error: any) => {
        console.error('[RequirementsAnalyzer] Clarification error:', error);
        this.enrichedPrompt = this.buildEnrichedPrompt();
        this.confidence = 0.8;
        this.proceedToWorkspace();
      }
    });
  }

  /**
   * Proceed to workspace with enriched prompt and answers
   */
  proceedToWorkspace(): void {
    const clarificationAnswers: ClarificationAnswer[] = [];

    Object.entries(this.answers).forEach(([questionId, answer]) => {
      if (answer && answer.trim()) {
        const question = this.questions.find(q => q.id === questionId);
        clarificationAnswers.push({
          questionId,
          question: question?.question || questionId,
          answer,
          // dimension carries through to composition so the synthesize_context
          // task can pre-classify answers without re-parsing question text.
          dimension: (question as any)?.dimension || '',
        });
      }
    });

    this.proceed.emit({
      enrichedPrompt: this.enrichedPrompt || this.prompt,
      answers: clarificationAnswers,
      confidence: this.confidence,
      canProceed: true,
      intakeArtifactId: this.intakeArtifactId || this.initialIntakeArtifactId || '',
      askSummary: this.askSummary,
    });
  }

  /**
   * Skip discovery and proceed with original prompt
   */
  skipDiscovery(): void {
    this.proceed.emit({
      enrichedPrompt: this.prompt,
      answers: [],
      confidence: this.confidence,
      canProceed: true,
      intakeArtifactId: this.intakeArtifactId || '',
      askSummary: this.askSummary,
    });
  }

  /**
   * Close dialog
   */
  closeDialog(): void {
    this.closed.emit();
  }

  /**
   * Select an option for a question.
   * For 'multiselect' questions, toggles the option on/off (comma-separated).
   * For 'radio' questions, replaces previous selection.
   */
  selectOption(questionId: string, option: string): void {
    const question = this.questions.find(q => q.id === questionId);
    const isMulti = question?.responseType === 'multiselect';

    if (isMulti) {
      const current = this.answers[questionId] || '';
      const selected = current ? current.split(', ').filter(s => s.trim()) : [];
      const idx = selected.indexOf(option);
      if (idx >= 0) {
        selected.splice(idx, 1); // deselect
      } else {
        selected.push(option); // add
      }
      this.answers[questionId] = selected.join(', ');
    } else {
      this.answers[questionId] = option;
    }
  }

  /**
   * Check if an option is currently selected (supports multiselect)
   */
  isOptionSelected(questionId: string, option: string): boolean {
    const val = this.answers[questionId] || '';
    const question = this.questions.find(q => q.id === questionId);
    if (question?.responseType === 'multiselect') {
      return val.split(', ').includes(option);
    }
    return val === option;
  }

  /**
   * Check if all required questions are answered
   */
  get allRequiredAnswered(): boolean {
    return this.questions
      .filter(q => q.required)
      .every(q => this.answers[q.id] && this.answers[q.id].trim() !== '');
  }

  /**
   * Get count of answered questions
   */
  get answeredCount(): number {
    return Object.values(this.answers).filter(a => a && a.trim() !== '').length;
  }

  /**
   * Get confidence color class
   */
  get confidenceColor(): string {
    if (this.confidence >= 0.8) return 'text-green-600';
    if (this.confidence >= 0.5) return 'text-amber-500';
    return 'text-red-500';
  }

  /**
   * Get confidence bar color
   */
  get confidenceBarColor(): string {
    if (this.confidence >= 0.8) return 'bg-green-500';
    if (this.confidence >= 0.5) return 'bg-amber-500';
    return 'bg-red-500';
  }

  /**
   * Get question text by ID (for display in summary)
   */
  getQuestionText(questionId: string): string {
    const q = this.questions.find(q => q.id === questionId);
    return q?.question || questionId.replace(/_/g, ' ');
  }

  private applyJobEvent(event: WorkspaceJobEvent): void {
    this.analysisStatusMessage = event.message || this.analysisStatusMessage;
    if (typeof event.percent === 'number') {
      this.analysisProgress = event.percent;
    }

    if (!event.stage) {
      return;
    }

    const nextStatus: 'active' | 'completed' = event.eventType === 'step_completed' || event.eventType === 'job_completed'
      ? 'completed'
      : 'active';
    const existingIndex = this.progressSteps.findIndex(step => step.stage === event.stage);
    if (existingIndex >= 0) {
      this.progressSteps[existingIndex] = {
        ...this.progressSteps[existingIndex],
        message: event.message || this.progressSteps[existingIndex].message,
        status: nextStatus,
      };
    } else {
      this.progressSteps = [
        ...this.progressSteps,
        {
          stage: event.stage,
          message: event.message || event.stage,
          status: nextStatus,
        }
      ];
    }

    if (nextStatus === 'active') {
      this.progressSteps = this.progressSteps.map(step =>
        step.stage === event.stage ? step : { ...step, status: 'completed' }
      );
    }
  }

  private handleAnalyzeResponse(response: AnalyzeResponse): void {
    this.analysisProgress = 100;
    this.confidence = response.confidence;
    this.canProceed = response.canProceed;
    this.intakeArtifactId = response.intakeArtifactId || '';
    this.askSummary = response.askSummary || this.askSummary;
    this.questions = response.questions || [];

    if (this.canProceed && this.questions.length === 0) {
      this.enrichedPrompt = this.prompt;
      setTimeout(() => this.proceedToWorkspace(), 250);
      return;
    }
    if (this.questions.length > 0) {
      this.phase = 'questions';
      this.questions.forEach(q => {
        if (q.options && q.options.length > 0) {
          this.answers[q.id] = this.answers[q.id] || '';
        }
      });
      return;
    }
    this.enrichedPrompt = this.prompt;
    setTimeout(() => this.proceedToWorkspace(), 250);
  }

  private handleClarifyResponse(response: ClarifyResponse): void {
    this.analysisProgress = 100;
    this.confidence = response.confidence;
    this.canProceed = response.canProceed;
    this.intakeArtifactId = response.intakeArtifactId || this.intakeArtifactId;
    this.askSummary = response.askSummary || this.askSummary;
    this.enrichedPrompt = this.buildEnrichedPrompt();

    if (response.status === 'clarification_required' && response.remainingQuestions?.length > 0) {
      this.questions = response.remainingQuestions;
      this.phase = 'questions';
      this.questions.forEach(q => {
        if (q.options && q.options.length > 0 && !this.answers[q.id]) {
          this.answers[q.id] = '';
        }
      });
      return;
    }
    this.proceedToWorkspace();
  }

  /**
   * Build enriched prompt from answers (fallback)
   */
  private buildEnrichedPrompt(): string {
    let enriched = this.prompt;
    const entries = Object.entries(this.answers).filter(([, v]) => v && v.trim());
    if (entries.length > 0) {
      enriched += '\n\n[Requirements Clarifications]\n';
      entries.forEach(([key, value]) => {
        const question = this.questions.find(q => q.id === key);
        const label = question?.question || key.replace(/_/g, ' ');
        enriched += `- ${label}: ${value}\n`;
      });
    }
    return enriched;
  }
}
