import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout, retry } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../../environments/environment';
import {
  AgentExecuteRequest,
  AgentExecuteResponse,
  ArchitectureGeneratorInput,
  AssessmentInput,
  E2ESystemDesignInput
} from '../models/agent.model';

/**
 * Agent Service
 * 
 * Service for executing architecture generation agents via API.
 * Handles authentication, request formatting, and error handling.
 * 
 * Configuration:
 * - Bearer token and username are configurable via environment files
 * - API base URL and endpoints are configurable
 * - Timeout and retry logic can be adjusted
 * 
 * Usage:
 * ```typescript
 * constructor(private agentService: AgentService) {}
 * 
 * generateArchitecture(prompt: string) {
 *   this.agentService.executeArchitectureGenerator({ prompt })
 *     .subscribe({
 *       next: (response) => console.log('Success:', response),
 *       error: (error) => console.error('Error:', error)
 *     });
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private readonly baseUrl = environment.api.baseUrl;
  private readonly agentExecuteUrl = `${this.baseUrl}${environment.api.endpoints.agentExecute}`;
  private readonly bearerToken = environment.auth.bearerToken;
  private readonly username = environment.auth.username;
  private readonly defaultAgentId = environment.agent.defaultAgentId;
  private readonly requestTimeout = environment.agent.timeout;

  constructor(private http: HttpClient) {}

  /**
   * Execute Architecture Generator Agent
   * 
   * @param input - Architecture generation input with prompt and optional context
   * @param agentId - Optional agent ID (defaults to environment config)
   * @returns Observable of agent execution response
   */
  executeArchitectureGenerator(
    input: ArchitectureGeneratorInput,
    agentId?: number
  ): Observable<AgentExecuteResponse> {
    const request: AgentExecuteRequest = {
      agentId: agentId || this.defaultAgentId,
      userInputs: {
        prompt: input.prompt,
        context: input.context,
        preferences: input.preferences
      },
      executionId: this.generateExecutionId(),
      user: this.username
    };

    return this.executeAgent(request);
  }

  /**
   * Execute Architecture Assessment Agent
   * 
   * @param input - Assessment input with prompt, options, and depth
   * @param agentId - Optional agent ID
   * @returns Observable of agent execution response
   */
  executeArchitectureAssessment(
    input: AssessmentInput,
    agentId?: number
  ): Observable<AgentExecuteResponse> {
    const request: AgentExecuteRequest = {
      agentId: agentId || this.defaultAgentId,
      userInputs: {
        prompt: input.prompt,
        selectedOptions: input.selectedOptions,
        assessmentDepth: input.assessmentDepth,
        artifacts: input.artifacts
      },
      executionId: this.generateExecutionId(),
      user: this.username
    };

    return this.executeAgent(request);
  }

  /**
   * Execute E2E System Design Agent
   * 
   * @param input - E2E system design input with requirements and constraints
   * @param agentId - Optional agent ID
   * @returns Observable of agent execution response
   */
  executeE2ESystemDesign(
    input: E2ESystemDesignInput,
    agentId?: number
  ): Observable<AgentExecuteResponse> {
    const request: AgentExecuteRequest = {
      agentId: agentId || this.defaultAgentId,
      userInputs: {
        prompt: input.prompt,
        requirements: input.requirements,
        constraints: input.constraints
      },
      executionId: this.generateExecutionId(),
      user: this.username
    };

    return this.executeAgent(request);
  }

  /**
   * Generic Agent Execution Method
   * 
   * @param request - Agent execution request
   * @returns Observable of agent execution response
   */
  executeAgent(request: AgentExecuteRequest): Observable<AgentExecuteResponse> {
    const headers = this.buildHeaders();

    return this.http
      .post<AgentExecuteResponse>(this.agentExecuteUrl, request, { headers })
      .pipe(
        timeout(this.requestTimeout),
        retry(2), // Retry failed requests twice
        catchError(this.handleError)
      );
  }

  /**
   * Execute Custom Agent with Raw User Inputs
   * 
   * @param agentId - Agent ID to execute
   * @param userInputs - Custom user inputs object
   * @param executionId - Optional custom execution ID
   * @returns Observable of agent execution response
   */
  executeCustomAgent(
    agentId: number,
    userInputs: Record<string, any>,
    executionId?: string
  ): Observable<AgentExecuteResponse> {
    const request: AgentExecuteRequest = {
      agentId,
      userInputs,
      executionId: executionId || this.generateExecutionId(),
      user: this.username
    };

    return this.executeAgent(request);
  }

  /**
   * Build HTTP Headers with Authorization
   * 
   * @returns HttpHeaders with Content-Type and Authorization
   */
  private buildHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.bearerToken}`
    });
  }

  /**
   * Generate Unique Execution ID
   * 
   * @returns UUID v4 string
   */
  private generateExecutionId(): string {
    return uuidv4();
  }

  /**
   * Handle HTTP Errors
   * 
   * @param error - HTTP error response
   * @returns Observable that throws formatted error
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error (${error.status}): ${error.message}`;
      
      if (error.error && typeof error.error === 'object') {
        if (error.error.message) {
          errorMessage += ` - ${error.error.message}`;
        }
        if (error.error.details) {
          errorMessage += ` - Details: ${JSON.stringify(error.error.details)}`;
        }
      }
    }

    console.error('Agent Service Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Get Current Configuration
   * 
   * @returns Current service configuration (useful for debugging)
   */
  getConfiguration() {
    return {
      baseUrl: this.baseUrl,
      agentExecuteUrl: this.agentExecuteUrl,
      username: this.username,
      hasToken: !!this.bearerToken,
      tokenLength: this.bearerToken?.length || 0,
      defaultAgentId: this.defaultAgentId,
      timeout: this.requestTimeout
    };
  }

  /**
   * Update Bearer Token at Runtime
   * (Use cautiously - prefer environment configuration)
   * 
   * @param token - New bearer token
   */
  updateBearerToken(token: string): void {
    // Note: This modifies the private property at runtime
    // Better approach: Use an auth service with token management
    (this as any).bearerToken = token;
  }

  /**
   * Update Username at Runtime
   * (Use cautiously - prefer environment configuration)
   * 
   * @param username - New username
   */
  updateUsername(username: string): void {
    (this as any).username = username;
  }
}
