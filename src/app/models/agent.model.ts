/**
 * Agent API Models
 * 
 * Type definitions for agent execution API requests and responses
 */

/**
 * Agent Execution Request
 * Used to initiate agent execution with specific parameters
 */
export interface AgentExecuteRequest {
  agentId: number;
  userInputs: Record<string, any>;
  executionId: string;
  user: string;
}

/**
 * Agent Execution Response
 * Response received after agent execution
 */
export interface AgentExecuteResponse {
  executionId: string;
  status: ExecutionStatus;
  result?: any;
  message?: string;
  timestamp?: string;
  error?: AgentError;
}

/**
 * Execution Status
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Agent Error
 */
export interface AgentError {
  code: string;
  message: string;
  details?: any;
}

/**
 * Agent Configuration
 */
export interface AgentConfig {
  agentId: number;
  name: string;
  description?: string;
  timeout?: number;
}

/**
 * User Input for different agent types
 */
export interface ArchitectureGeneratorInput {
  prompt: string;
  context?: string;
  preferences?: Record<string, any>;
}

export interface AssessmentInput {
  prompt: string;
  selectedOptions?: string[];
  assessmentDepth?: 'quick' | 'standard' | 'comprehensive';
  artifacts?: string[];
}

export interface E2ESystemDesignInput {
  prompt: string;
  requirements?: string[];
  constraints?: Record<string, any>;
}
