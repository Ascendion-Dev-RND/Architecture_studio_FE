import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { MermaidCanvasComponent } from '../../components/mermaid-canvas/mermaid-canvas.component';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';
import { BlueprintService, Blueprint, BlueprintSection, ClarifyResponse, ClarificationQuestion, StreamEvent, SolutionBlueprint, BlueprintDiagramRef, ComposeResult } from '../../services/blueprint.service';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isLoading?: boolean;
  deltaNotes?: string;
  isStreaming?: boolean;
}

@Component({
  selector: 'app-solution-blueprint-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, MermaidCanvasComponent, BreadcrumbComponent],
  templateUrl: './solution-blueprint-workspace.component.html',
  styleUrls: ['./solution-blueprint-workspace.component.css']
})
export class SolutionBlueprintWorkspaceComponent implements OnInit, AfterViewInit {
  @ViewChild('chatScroll') chatScrollRef!: ElementRef;

  chatMessages: ChatMessage[] = [];
  userInput: string = '';
  isChatCollapsed: boolean = false;
  isLoading: boolean = false;
  isChatLoading: boolean = false;
  isExporting: boolean = false;

  // ── Diagram set (FLOW 2 composition) ───────────────────────────────────
  composing: boolean = false;
  composeStatus: string = '';
  blueprintWorkspaceId: string = '';
  blueprintId: string = '';
  blueprintDiagrams: BlueprintDiagramRef[] = [];
  composeClarifications: any[] = [];
  composeAnswers: { [qid: string]: string } = {};

  // Blueprint state
  blueprint: Blueprint | null = null;
  blueprintVersions: Blueprint[] = [];
  systemName: string = '';
  mode: 'greenfield' | 'brownfield' = 'greenfield';

  // Clarification state
  showClarifications: boolean = false;
  showClarificationModal: boolean = false;  // Popup modal flag
  clarifyResponse: ClarifyResponse | null = null;
  clarificationAnswers: { [key: string]: string } = {};

  // Streaming state
  isStreaming: boolean = false;
  streamProgress: number = 0;
  streamTotal: number = 0;
  streamingMessage: string = '';

  // Input state from router
  prompt: string = '';
  context: string = '';

  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Solution Blueprint', link: '/solution-blueprint' },
    { label: 'Workspace' }
  ];

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private blueprintService: BlueprintService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Read router state from history (more reliable than getCurrentNavigation)
    const state = history.state;
    
    console.log('[SolutionBlueprint] ngOnInit - state:', state);
    console.log('[SolutionBlueprint] prompt:', state?.prompt);
    console.log('[SolutionBlueprint] mode:', state?.mode);

    if (state?.prompt && state.prompt !== 'undefined' && state.prompt.trim() !== '') {
      this.prompt = state.prompt;
      this.context = state.context || '';
      this.mode = state.mode || 'greenfield';

      this.chatMessages.push({ role: 'user', content: this.prompt });
      
      console.log('[SolutionBlueprint] Starting clarification with prompt:', this.prompt.substring(0, 100));

      // Step 1: Run clarification analysis
      this.runClarification();
    } else {
      console.log('[SolutionBlueprint] No valid prompt in state, showing welcome message');
      // No valid state - show welcome message
      this.chatMessages.push({
        role: 'assistant',
        content: 'Welcome to Solution Blueprint. Please provide your requirements to get started.'
      });
    }
  }

  ngAfterViewInit(): void {
    // Trigger change detection after view init to ensure template updates
    this.cdr.detectChanges();
  }

  // ── Clarification Flow ─────────────────────────────────────────────────

  private runClarification(): void {
    this.isLoading = true;
    this.cdr.detectChanges();
    
    const fileNames = (history.state?.attachments || []).map((f: any) => f.name || '');
    
    console.log('[SolutionBlueprint] Calling clarify API with:', {
      prompt: this.prompt.substring(0, 100),
      context: this.context?.substring(0, 50),
      fileNames
    });

    this.blueprintService.clarify(this.prompt, this.context, this.mode, fileNames)
      .subscribe({
        next: (resp) => {
          console.log('[SolutionBlueprint] Clarify response:', resp);
          this.clarifyResponse = resp;
          this.mode = resp.mode;

          if (resp.canSkip && resp.sufficiency >= 0.7) {
            // Sufficient info — skip clarifications, generate directly
            this.chatMessages.push({
              role: 'assistant',
              content: `Requirements analysis complete (${Math.round(resp.sufficiency * 100)}% sufficient). Generating ${resp.mode} blueprint...`
            });
            this.generateBlueprint();
          } else if (resp.questions && resp.questions.length > 0) {
            // Show clarification popup modal (like architecture workbench)
            this.showClarificationModal = true;
            this.showClarifications = false;
            this.isLoading = false;
            this.chatMessages.push({
              role: 'assistant',
              content: `I've analyzed your requirements (${Math.round(resp.sufficiency * 100)}% sufficient, mode: ${resp.mode}). Please answer the clarification questions to produce a more accurate blueprint.`
            });
            this.cdr.detectChanges();
          } else {
            // No questions, generate directly
            this.chatMessages.push({
              role: 'assistant',
              content: `Requirements analyzed. Generating ${resp.mode} blueprint...`
            });
            this.generateBlueprint();
          }
        },
        error: (err) => {
          console.error('[SolutionBlueprint] Clarification API failed:', err);
          this.isLoading = false;
          // Fallback: generate without clarifications
          this.chatMessages.push({
            role: 'assistant',
            content: 'Analyzing requirements... Generating blueprint based on available information.'
          });
          this.cdr.detectChanges();
          setTimeout(() => this.generateBlueprint(), 300);
        }
      });
  }

  answerClarification(questionId: string, answer: string): void {
    this.clarificationAnswers[questionId] = answer;
  }

  setClarificationFreeText(questionId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value.trim()) {
      this.clarificationAnswers[questionId] = input.value.trim();
    }
  }

  skipClarifications(): void {
    this.showClarifications = false;
    this.showClarificationModal = false;
    this.chatMessages.push({ role: 'system', content: 'Clarifications skipped — generating with available information.' });
    this.generateBlueprintWithStreaming();
  }

  submitClarifications(): void {
    this.showClarifications = false;
    this.showClarificationModal = false;
    const answered = Object.keys(this.clarificationAnswers).length;
    this.chatMessages.push({
      role: 'system',
      content: `${answered} clarification(s) submitted. Generating ${this.mode} blueprint...`
    });
    this.generateBlueprintWithStreaming();
  }

  closeClarificationModal(): void {
    this.showClarificationModal = false;
  }

  get answeredCount(): number {
    return Object.keys(this.clarificationAnswers).length;
  }

  get requiredUnanswered(): number {
    if (!this.clarifyResponse) return 0;
    return this.clarifyResponse.questions
      .filter(q => q.required && !this.clarificationAnswers[q.id])
      .length;
  }

  get sufficiencyPercent(): number {
    return Math.round((this.clarifyResponse?.sufficiency || 0) * 100);
  }

  // ── Blueprint Generation ───────────────────────────────────────────────

  private generateBlueprintWithStreaming(): void {
    this.isLoading = true;
    this.isStreaming = true;
    this.showClarifications = false;
    this.showClarificationModal = false;
    this.streamProgress = 0;
    this.streamTotal = 0;
    this.streamingMessage = 'Initializing blueprint generation...';
    this.cdr.detectChanges();
    
    console.log('[SolutionBlueprint] Starting streaming generate with:', {
      prompt: this.prompt.substring(0, 100),
      mode: this.mode,
      clarifications: Object.keys(this.clarificationAnswers).length
    });

    this.blueprintService.generateStream(
      this.prompt,
      this.mode,
      this.clarificationAnswers,
      this.context
    ).subscribe({
      next: (event: StreamEvent) => {
        console.log('[SolutionBlueprint] Stream event:', event.type);
        
        switch (event.type) {
          case 'init':
            if (event.blueprint) {
              this.blueprint = event.blueprint as Blueprint;
              this.systemName = this.blueprint.systemName;
              this.streamTotal = (event as any).blueprint?.totalSections || 0;
              this.streamingMessage = `Generating ${this.streamTotal} sections...`;
            }
            break;
            
          case 'section':
            if (event.section && this.blueprint) {
              this.blueprint.sections.push(event.section);
              this.streamProgress = (event.index || 0) + 1;
              this.streamingMessage = `Generated: ${event.section.title} (${this.streamProgress}/${this.streamTotal})`;
            }
            break;
            
          case 'complete':
            if (event.blueprint) {
              this.blueprint = event.blueprint as Blueprint;
              this.systemName = this.blueprint.systemName;
              this.blueprintVersions.push(JSON.parse(JSON.stringify(this.blueprint)));
            }
            this.isLoading = false;
            this.isStreaming = false;
            this.streamingMessage = '';
            
            this.chatMessages.push({
              role: 'assistant',
              content: `Blueprint generated for "${this.blueprint?.systemName}" (${this.blueprint?.mode}, v${this.blueprint?.version}). ${this.blueprint?.sections.length} sections produced. Use the chat to refine any section.`
            });
            this.scrollChatToBottom();
            break;
            
          case 'error':
            console.error('[SolutionBlueprint] Stream error:', event.message);
            this.isStreaming = false;
            // Fall back to non-streaming generation
            this.generateBlueprint();
            break;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[SolutionBlueprint] Stream failed, falling back:', err);
        this.isStreaming = false;
        // Fall back to non-streaming generation
        this.generateBlueprint();
      },
      complete: () => {
        console.log('[SolutionBlueprint] Stream completed');
        this.isStreaming = false;
        this.cdr.detectChanges();
      }
    });
  }

  private generateBlueprint(): void {
    this.isLoading = true;
    this.showClarifications = false;
    this.cdr.detectChanges();
    
    console.log('[SolutionBlueprint] Calling generate API with:', {
      prompt: this.prompt.substring(0, 100),
      mode: this.mode,
      clarifications: Object.keys(this.clarificationAnswers).length
    });

    this.blueprintService.generate(
      this.prompt,
      this.mode,
      this.clarificationAnswers,
      this.context
    ).subscribe({
      next: (bp) => {
        console.log('[SolutionBlueprint] Generate response:', bp);
        console.log('[SolutionBlueprint] Sections:', bp.sections?.length);
        
        this.blueprint = bp;
        this.systemName = bp.systemName;
        this.blueprintVersions.push(JSON.parse(JSON.stringify(bp)));
        this.isLoading = false;

        this.chatMessages.push({
          role: 'assistant',
          content: `Blueprint generated for "${bp.systemName}" (${bp.mode}, v${bp.version}). ${bp.sections.length} sections produced. Use the chat to refine any section.`
        });
        this.cdr.detectChanges();
        this.scrollChatToBottom();
      },
      error: (err) => {
        console.error('[SolutionBlueprint] Generate API failed:', err);
        this.isLoading = false;
        
        // Generate mock blueprint as fallback to prevent blank screen
        this.blueprint = this.createMockBlueprint();
        this.systemName = this.blueprint.systemName;
        this.blueprintVersions.push(JSON.parse(JSON.stringify(this.blueprint)));
        
        this.chatMessages.push({
          role: 'assistant',
          content: `Blueprint generated for "${this.blueprint.systemName}" (${this.mode}, v1). Note: Using fallback data due to backend unavailability. Refinement features may be limited.`
        });
        this.cdr.detectChanges();
        this.scrollChatToBottom();
      }
    });
  }

  private createMockBlueprint(): Blueprint {
    const systemName = this.extractSystemName(this.prompt);
    const isBrownfield = this.mode === 'brownfield';
    
    const sections: BlueprintSection[] = [
      {
        id: 'executive_summary',
        title: 'Executive Summary',
        icon: 'FileText',
        order: 1,
        status: 'draft',
        contentType: 'prose',
        collapsed: false,
        content: {
          summary: isBrownfield 
            ? `This blueprint defines the enhancement of the existing ${systemName} platform to incorporate new capabilities while preserving backward compatibility.`
            : `This blueprint outlines a comprehensive solution for the ${systemName} — a modern platform built on microservices architecture with enterprise-grade security and scalability.`,
          highlights: [
            `Architecture Style: Microservices with event-driven communication`,
            `Target Platform: AWS/Azure/GCP`,
            `Mode: ${isBrownfield ? 'Enhancement of existing system' : 'New greenfield build'}`,
          ]
        }
      },
      {
        id: 'scope',
        title: 'Scope & Out of Scope',
        icon: 'Target',
        order: 2,
        status: 'draft',
        contentType: 'mixed',
        collapsed: true,
        content: {
          inScope: [
            'Core business logic implementation',
            'User authentication and authorization',
            'API gateway and service routing',
            'Data persistence and caching',
            'Monitoring and observability'
          ],
          outOfScope: [
            'Mobile native application development',
            'Third-party integrations beyond defined scope',
            'Performance tuning of legacy databases'
          ]
        }
      },
      {
        id: 'assumptions_constraints',
        title: 'Assumptions, Constraints & Open Questions',
        icon: 'HelpCircle',
        order: 3,
        status: 'draft',
        contentType: 'mixed',
        collapsed: true,
        content: {
          assumptions: [
            'Cloud provider account and permissions are available',
            'CI/CD pipeline infrastructure exists or will be provisioned',
            'Team has familiarity with containerized deployments'
          ],
          constraints: [
            'Must comply with organizational security policies',
            'Budget constraints may limit multi-region deployment initially'
          ],
          openQuestions: [
            { question: 'Exact SLA requirements for production environment', status: 'open' },
            { question: 'Disaster recovery RPO/RTO targets', status: 'open' }
          ]
        }
      },
      {
        id: 'target_architecture',
        title: 'Target Architecture Overview',
        icon: 'Layers',
        order: 6,
        status: 'draft',
        contentType: 'diagram',
        collapsed: false,
        content: {
          description: `The target architecture for ${systemName} follows a microservices pattern. Services communicate via API Gateway (synchronous) and message queue (asynchronous).`,
          diagram: `graph TB
    subgraph "Client Layer"
        WEB[Web Application]
        MOB[Mobile / PWA]
    end
    subgraph "Edge"
        CDN[CDN]
        LB[Load Balancer]
        APIGW[API Gateway]
    end
    subgraph "Services"
        SVC1[User Service]
        SVC2[Order Service]
        SVC3[Product Service]
    end
    subgraph "Data"
        DB[(Database)]
        CACHE[(Redis Cache)]
    end
    WEB --> CDN
    MOB --> CDN
    CDN --> LB
    LB --> APIGW
    APIGW --> SVC1
    APIGW --> SVC2
    APIGW --> SVC3
    SVC1 --> DB
    SVC2 --> DB
    SVC3 --> CACHE`,
          diagramType: 'mermaid',
          keyDecisions: [
            'Microservices with domain-driven bounded contexts',
            'API Gateway for unified entry point',
            'Event-driven inter-service communication',
            'Database-per-service pattern'
          ]
        }
      },
      {
        id: 'component_design',
        title: 'Component / Service Design',
        icon: 'Server',
        order: 7,
        status: 'draft',
        contentType: 'mixed',
        collapsed: true,
        content: {
          services: [
            { name: 'User Service', responsibility: 'User lifecycle management', techStack: 'Spring Boot', database: 'PostgreSQL' },
            { name: 'Order Service', responsibility: 'Order processing and workflow', techStack: 'Spring Boot', database: 'PostgreSQL' },
            { name: 'Notification Service', responsibility: 'Email, SMS, push notifications', techStack: 'Node.js', database: 'MongoDB' }
          ],
          crossCutting: [
            { name: 'API Gateway', purpose: 'Authentication, rate limiting, routing' },
            { name: 'Service Mesh', purpose: 'mTLS, traffic management' },
            { name: 'Config Server', purpose: 'Centralized configuration' }
          ]
        }
      },
      {
        id: 'data_design',
        title: 'Data Design',
        icon: 'Database',
        order: 9,
        status: 'draft',
        contentType: 'mixed',
        collapsed: true,
        content: {
          primaryDatabase: 'PostgreSQL',
          cacheLayer: 'Redis',
          dataStrategy: [
            'Database-per-service for data isolation',
            'Event sourcing for audit-critical operations',
            'CQRS for read-heavy workloads'
          ]
        }
      },
      {
        id: 'security_iam',
        title: 'Security & IAM',
        icon: 'Shield',
        order: 10,
        status: 'draft',
        contentType: 'mixed',
        collapsed: true,
        content: {
          authentication: 'OAuth 2.0 / OIDC',
          authorization: 'Role-Based Access Control (RBAC)',
          encryption: [
            'TLS 1.3 for data in transit',
            'AES-256 for data at rest'
          ],
          compliance: ['GDPR', 'SOC 2']
        }
      },
      {
        id: 'tech_stack',
        title: 'Technology Stack',
        icon: 'Code',
        order: 18,
        status: 'draft',
        contentType: 'table',
        collapsed: true,
        content: {
          technologies: [
            { layer: 'Frontend', primary: 'React / Angular', alternatives: 'Vue.js' },
            { layer: 'Backend', primary: 'Spring Boot / Node.js', alternatives: 'Python FastAPI' },
            { layer: 'Database', primary: 'PostgreSQL', alternatives: 'MySQL, MongoDB' },
            { layer: 'Cache', primary: 'Redis', alternatives: 'Memcached' },
            { layer: 'Cloud', primary: 'AWS', alternatives: 'Azure, GCP' }
          ]
        }
      },
      {
        id: 'implementation_roadmap',
        title: 'Implementation Roadmap',
        icon: 'Calendar',
        order: 17,
        status: 'draft',
        contentType: 'mixed',
        collapsed: true,
        content: {
          phases: [
            { phase: 'Phase 1', duration: '4 weeks', deliverables: 'Core infrastructure, CI/CD, basic services' },
            { phase: 'Phase 2', duration: '6 weeks', deliverables: 'Feature development, integrations' },
            { phase: 'Phase 3', duration: '4 weeks', deliverables: 'Testing, optimization, go-live' }
          ]
        }
      }
    ];

    // Add brownfield-specific sections
    if (isBrownfield) {
      sections.splice(3, 0, {
        id: 'current_state_summary',
        title: 'Current State Summary',
        icon: 'Archive',
        order: 4,
        status: 'draft',
        contentType: 'prose',
        collapsed: true,
        content: {
          description: `The current ${systemName} system operates as a production workload. This section summarizes the existing architecture based on provided artifacts.`,
          currentChallenges: [
            'Scalability limitations in current architecture',
            'Technical debt in legacy modules',
            'Limited observability and monitoring'
          ]
        }
      });
      sections.splice(4, 0, {
        id: 'impact_analysis',
        title: 'Impact & Delta Analysis',
        icon: 'GitCompare',
        order: 5,
        status: 'draft',
        contentType: 'mixed',
        collapsed: true,
        content: {
          description: 'Analysis of the impact the proposed changes will have on the existing system.',
          riskLevel: 'Medium',
          integrationImpact: [
            'Existing API endpoints preserved (backward compatible)',
            'New API versions introduced (v2) for enhanced functionality'
          ]
        }
      });
    }

    return {
      id: 'mock-' + Date.now(),
      version: 1,
      mode: this.mode,
      systemName,
      domain: 'enterprise',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections
    };
  }

  private extractSystemName(prompt: string): string {
    const match = prompt.match(/(?:build|create|design|develop)\s+(?:a\s+|an\s+)?([a-zA-Z\s]+?)(?:\s+system|\s+platform|\s+application|\s+app)/i);
    return match ? match[1].trim() : 'Solution System';
  }

  // ── Chat-Driven Refinement ─────────────────────────────────────────────

  sendMessage(): void {
    if (!this.userInput.trim() || this.isChatLoading) return;

    const msg = this.userInput.trim();
    this.userInput = '';
    this.chatMessages.push({ role: 'user', content: msg });

    if (!this.blueprint) {
      this.chatMessages.push({ role: 'assistant', content: 'No blueprint loaded. Please generate one first.' });
      return;
    }

    this.isChatLoading = true;
    this.chatMessages.push({ role: 'assistant', content: 'Analyzing your request...', isLoading: true, isStreaming: true });
    this.cdr.detectChanges();

    // Use streaming for chat refinement
    this.blueprintService.refineStream(this.blueprint, msg).subscribe({
      next: (event: StreamEvent) => {
        console.log('[SolutionBlueprint] Refine stream event:', event.type);
        
        switch (event.type) {
          case 'thinking':
            // Update the loading message
            const loadingIdx = this.chatMessages.findIndex(m => m.isLoading);
            if (loadingIdx >= 0) {
              this.chatMessages[loadingIdx].content = event.message || 'Processing...';
            }
            break;
            
          case 'section':
            // Apply each section update as it streams in
            if (event.section && this.blueprint) {
              const idx = this.blueprint.sections.findIndex(s => s.id === event.section!.id);
              if (idx >= 0) {
                this.blueprint.sections[idx].content = event.section.content;
                this.blueprint.sections[idx].status = event.section.status as any;
                this.blueprint.sections[idx].collapsed = false;
              }
            }
            break;
            
          case 'complete':
            // Remove loading message
            this.chatMessages = this.chatMessages.filter(m => !m.isLoading);
            
            if (event.updatedCount && event.updatedCount > 0) {
              this.blueprint!.version++;
              this.blueprint!.updatedAt = new Date().toISOString();
              this.blueprintVersions.push(JSON.parse(JSON.stringify(this.blueprint)));
              
              this.chatMessages.push({
                role: 'assistant',
                content: `Updated ${event.updatedCount} section(s).`,
                deltaNotes: event.deltaNotes
              });
            } else {
              this.chatMessages.push({
                role: 'assistant',
                content: event.deltaNotes || 'No sections were updated. Try being more specific about which aspect to change.'
              });
            }
            
            this.isChatLoading = false;
            this.scrollChatToBottom();
            break;
            
          case 'error':
            this.chatMessages = this.chatMessages.filter(m => !m.isLoading);
            this.chatMessages.push({ role: 'assistant', content: `Error: ${event.message || 'Refinement failed'}` });
            this.isChatLoading = false;
            break;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[SolutionBlueprint] Refine stream error, falling back:', err);
        this.chatMessages = this.chatMessages.filter(m => !m.isLoading);
        // Fall back to non-streaming
        this.refineWithoutStreaming(msg);
      },
      complete: () => {
        this.isChatLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private refineWithoutStreaming(msg: string): void {
    if (!this.blueprint) return;
    
    this.chatMessages.push({ role: 'assistant', content: '', isLoading: true });
    
    this.blueprintService.refine(this.blueprint, msg).subscribe({
      next: (resp) => {
        this.chatMessages = this.chatMessages.filter(m => !m.isLoading);

        if (resp.updatedSections && resp.updatedSections.length > 0) {
          for (const updated of resp.updatedSections) {
            const idx = this.blueprint!.sections.findIndex(s => s.id === updated.id);
            if (idx >= 0) {
              this.blueprint!.sections[idx].content = updated.content;
              this.blueprint!.sections[idx].status = updated.status as any;
              this.blueprint!.sections[idx].collapsed = false;
            }
          }
          this.blueprint!.version++;
          this.blueprint!.updatedAt = new Date().toISOString();
          this.blueprintVersions.push(JSON.parse(JSON.stringify(this.blueprint)));

          const names = resp.updatedSections.map(s => s.title).join(', ');
          this.chatMessages.push({
            role: 'assistant',
            content: `Updated ${resp.updatedSections.length} section(s): ${names}`,
            deltaNotes: resp.deltaNotes
          });
        } else {
          this.chatMessages.push({
            role: 'assistant',
            content: resp.deltaNotes || 'No sections were updated. Try being more specific about which aspect to change.'
          });
        }

        this.isChatLoading = false;
        this.scrollChatToBottom();
        this.cdr.detectChanges();
      },
      error: () => {
        this.chatMessages = this.chatMessages.filter(m => !m.isLoading);
        this.chatMessages.push({ role: 'assistant', content: 'Refinement failed. Please try again.' });
        this.isChatLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Section Actions ────────────────────────────────────────────────────

  toggleSection(section: BlueprintSection): void {
    section.collapsed = !section.collapsed;
  }

  collapseAll(): void {
    this.blueprint?.sections.forEach(s => s.collapsed = true);
  }

  expandAll(): void {
    this.blueprint?.sections.forEach(s => s.collapsed = false);
  }

  refineSection(section: BlueprintSection): void {
    this.userInput = `Improve the "${section.title}" section`;
  }

  regenerateSection(section: BlueprintSection): void {
    if (!this.blueprint) return;
    this.isChatLoading = true;
    this.chatMessages.push({ role: 'user', content: `Regenerate "${section.title}" section` });

    this.blueprintService.refine(this.blueprint, `Regenerate the ${section.title} section with more detail`, [section.id])
      .subscribe({
        next: (resp) => {
          if (resp.updatedSections?.length) {
            const idx = this.blueprint!.sections.findIndex(s => s.id === section.id);
            if (idx >= 0) {
              this.blueprint!.sections[idx].content = resp.updatedSections[0].content;
              this.blueprint!.sections[idx].collapsed = false;
            }
            this.blueprint!.version++;
            this.blueprintVersions.push(JSON.parse(JSON.stringify(this.blueprint)));
          }
          this.chatMessages.push({ role: 'assistant', content: `"${section.title}" has been regenerated.` });
          this.isChatLoading = false;
        },
        error: () => {
          this.chatMessages.push({ role: 'assistant', content: 'Section regeneration failed.' });
          this.isChatLoading = false;
        }
      });
  }

  finalizeSection(section: BlueprintSection): void {
    section.status = section.status === 'finalized' ? 'draft' : 'finalized';
  }

  // ── Open Question Handling ─────────────────────────────────────────────

  answerOpenQuestion(sectionId: string, questionIndex: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!this.blueprint || !input.value.trim()) return;

    const section = this.blueprint.sections.find(s => s.id === sectionId);
    if (section?.content?.openQuestions?.[questionIndex]) {
      section.content.openQuestions[questionIndex].status = 'answered';
      section.content.openQuestions[questionIndex].answer = input.value.trim();
      input.value = '';
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────

  exportMarkdown(): void {
    if (!this.blueprint) return;
    this.isExporting = true;

    this.blueprintService.export(this.blueprint).subscribe({
      next: (resp) => {
        // Download as file
        const blob = new Blob([resp.markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resp.filename;
        a.click();
        URL.revokeObjectURL(url);
        this.isExporting = false;
        this.chatMessages.push({ role: 'system', content: `Exported: ${resp.filename}` });
      },
      error: () => {
        this.isExporting = false;
        this.chatMessages.push({ role: 'assistant', content: 'Export failed.' });
      }
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  toggleChat(): void {
    this.isChatCollapsed = !this.isChatCollapsed;
  }

  editInWorkbench(diagramType: string): void {
    this.router.navigate(['/architecture-workspace'], {
      queryParams: { diagramType, source: 'solution-blueprint' }
    });
  }

  // ── Diagram set composition (FLOW 2) ───────────────────────────────────

  /** Generate the full architecture diagram set (cloud, C4, CI/CD, infra) via v2. */
  composeDiagrams(): void {
    this.composing = true;
    this.composeStatus = 'Generating architecture diagrams (cloud, C4 context & container, CI/CD, infrastructure)…';
    this.composeClarifications = [];
    this.cdr.detectChanges();

    const intake = this.buildIntakeArtifact();
    const answers = Object.keys(this.composeAnswers)
      .map(qid => ({ questionId: qid, answer: this.composeAnswers[qid] }));

    this.blueprintService.composeBlueprint(intake, intake.blueprintWorkspaceId, answers, this.chatMessages)
      .subscribe({
        next: (res: ComposeResult) => {
          this.composing = false;
          if (res.status === 'clarification_required') {
            this.composeClarifications = res.clarificationQuestions || [];
            this.composeStatus = 'A couple of details are needed before generating the diagrams.';
            this.cdr.detectChanges();
            return;
          }
          if (res.blueprint) {
            this.blueprintWorkspaceId = res.blueprint.workspaceId;
            this.blueprintId = res.blueprint.blueprintId;
            this.blueprintDiagrams = res.blueprint.diagrams || [];
            const ready = this.readyDiagramCount();
            this.composeStatus = `Generated ${ready}/${this.blueprintDiagrams.length} architecture diagrams.`;
            this.chatMessages.push({
              role: 'assistant',
              content: `${ready} architecture diagram(s) generated for "${res.blueprint.systemName}". Open any diagram to edit it in the workbench.`
            });
          } else {
            this.composeStatus = res.error || 'Diagram generation failed.';
          }
          this.cdr.detectChanges();
          this.scrollChatToBottom();
        },
        error: (e) => {
          this.composing = false;
          this.composeStatus = 'Diagram generation failed: ' + (e?.message || 'unknown error');
          this.cdr.detectChanges();
        }
      });
  }

  answerComposeClar(qid: string, answer: string): void {
    this.composeAnswers[qid] = answer;
  }

  submitComposeClarifications(): void {
    this.composeClarifications = [];
    this.composeDiagrams();
  }

  /** SVG URL for a generated diagram (gallery thumbnail / preview). */
  diagramSvgUrl(d: BlueprintDiagramRef): string {
    return this.blueprintService.renderDiagramUrl(d.diagramId, this.blueprintWorkspaceId);
  }

  /** Open a generated diagram in the architecture workbench for editing. */
  editDiagramInWorkbench(d: BlueprintDiagramRef): void {
    if (!d || d.status !== 'ready' || !d.diagramId) return;
    this.router.navigate(['/architecture-workspace'], {
      queryParams: {
        workspaceId: this.blueprintWorkspaceId,
        diagramId: d.diagramId,
        viewType: d.viewType,
        source: 'solution-blueprint',
        blueprintId: this.blueprintId,
      }
    });
  }

  retryDiagram(d: BlueprintDiagramRef): void {
    // Re-run the whole set (per-view retry is a Phase-3 refinement).
    this.composeDiagrams();
  }

  readyDiagramCount(): number {
    return this.blueprintDiagrams.filter(d => d.status === 'ready').length;
  }

  private buildIntakeArtifact(): any {
    const ws = this.uuid();
    const blob = (this.prompt + ' ' + Object.values(this.clarificationAnswers).join(' ')).toLowerCase();
    const deploymentPreferences: string[] = [];
    const provMap: [string, string][] = [['aws', 'AWS'], ['azure', 'Azure'], ['google cloud', 'GCP'], ['gcp', 'GCP']];
    for (const [tok, label] of provMap) { if (blob.includes(tok)) { deploymentPreferences.push(label); break; } }
    return {
      intakeSessionId: 'sb-' + Date.now(),
      workspaceId: ws,
      projectId: this.uuid(),
      blueprintWorkspaceId: ws,
      decision: 'READY',
      blueprintMode: this.mode,
      systemName: this.systemName || this.extractSystemName(this.prompt),
      domain: this.blueprint?.domain || '',
      businessObjective: this.prompt.substring(0, 200),
      inScopeCapabilities: [],
      integrationNeeds: [],
      qualityAttributes: [],
      complianceRequirements: [],
      technologyPreferences: [],
      deploymentPreferences,
      targetUsers: [],
      stakeholders: [],
      originalPrompt: this.prompt,
      documentPageIndex: [],
    };
  }

  private uuid(): string {
    const c: any = (typeof crypto !== 'undefined') ? crypto : null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
      const r = Math.random() * 16 | 0;
      const v = ch === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  viewFullScreen(): void {
    this.router.navigate(['/solution-blueprint-output']);
  }

  regenerateBlueprint(): void {
    if (!this.prompt) return;
    this.chatMessages.push({ role: 'user', content: 'Regenerate entire blueprint' });
    this.generateBlueprint();
  }

  // ── Utilities ──────────────────────────────────────────────────────────

  private scrollChatToBottom(): void {
    setTimeout(() => {
      if (this.chatScrollRef?.nativeElement) {
        this.chatScrollRef.nativeElement.scrollTop = this.chatScrollRef.nativeElement.scrollHeight;
      }
    }, 100);
  }

  isArray(val: any): boolean {
    return Array.isArray(val);
  }

  isObject(val: any): boolean {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  formatKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ');
  }

  trackSection(index: number, section: BlueprintSection): string {
    return section.id;
  }
}
