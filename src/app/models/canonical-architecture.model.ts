/**
 * Canonical Architecture Model — TypeScript interfaces.
 * Mirrors Java CanonicalArchitectureModel in diagram-service
 * and Python Pydantic models in agents.
 *
 * These are the shared contracts across all 3 layers.
 */

// ── Enums ─────────────────────────────────────────────────────────────

export type ArchitectureMode = 'greenfield' | 'enhance' | 'transform' | 'review';
export type DepthLevel = 'conceptual' | 'logical' | 'deployment' | 'detailed-deployment';
export type EnvironmentClass = 'dev' | 'test' | 'staging' | 'production' | 'dr';
export type CriticalityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ArchitectureTemplate = 'microservices' | 'serverless' | 'event-driven' | 'data-pipeline' | 'monolith' | 'hybrid';
export type RelationshipType = 'sync' | 'async' | 'replication' | 'monitoring' | 'deployment' | 'auth';
export type MutationActionType =
  | 'add-component' | 'remove-component' | 'replace-component' | 'modify-component'
  | 'add-relationship' | 'remove-relationship'
  | 'add-boundary' | 'remove-boundary'
  | 'add-external-system' | 'replicate-components' | 'reshape-topology' | 'annotate-component';

// ── Sub-models ────────────────────────────────────────────────────────

export interface ClarificationAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface SourceArtifact {
  artifactId: string;
  type: string;
  filename?: string;
  ingestedAt?: string;
  extractedComponents: number;
  confidence: number;
}

export interface ArchitectureContext {
  originalPrompt: string;
  clarificationAnswers: ClarificationAnswer[];
  sourceArtifacts: SourceArtifact[];
  agentTraceIds: string[];
}

export interface Assumption {
  id: string;
  statement: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'agent-inferred' | 'user-specified' | 'default';
}

export interface OpenQuestion {
  id: string;
  question: string;
  dimension: string;
  severity: string;
}

export interface Actor {
  id: string;
  label: string;
  type: 'human' | 'system' | 'external-service';
  description: string;
}

export interface ExternalSystem {
  id: string;
  label: string;
  type: 'saas' | 'api' | 'legacy' | 'partner';
  protocol: string;
  dataClassification: string;
}

export interface Boundary {
  id: string;
  type: string;
  label: string;
  parentBoundaryId?: string;
  providerConfig: Record<string, any>;
  children: string[];
}

export interface Zone {
  id: string;
  type: string;
  label: string;
  boundaryId?: string;
  purpose: string;
}

export interface Layer {
  id: string;
  label: string;
  type: string;
  components: string[];
}

export interface ScalingPolicy {
  type: string;
  minInstances: number;
  maxInstances: number;
  metric: string;
  targetValue: number;
}

export interface CanonicalComponent {
  id: string;
  label: string;
  type: string;
  technology: string;
  providerService: string;
  iconId: string;
  zoneId: string;
  layerId: string;
  boundaryId: string;
  replicas: number;
  scalingPolicy?: ScalingPolicy;
  properties: Record<string, any>;
  tags: string[];
  confidence: number;
  source: string;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  protocol: string;
  label: string;
  dataClassification: string;
  properties: Record<string, any>;
}

export interface SecurityControl {
  id: string;
  type: string;
  componentId: string;
  scope: string;
  standard: string;
  enabled: boolean;
}

export interface ObservabilityControl {
  id: string;
  type: string;
  componentId: string;
  coverage: string[];
}

export interface DeploymentControl {
  id: string;
  type: string;
  componentId: string;
  targetComponents: string[];
}

export interface HADRStrategy {
  haMode: string;
  numAZs: number;
  drMode: string;
  rpo: string;
  rto: string;
  failoverAutomated: boolean;
}

export interface ScalingStrategy {
  approach: string;
  peakLoad: string;
  burstCapacity: string;
}

export interface PrincipleApplied {
  id: string;
  name: string;
  pillar: string;
  applied: boolean;
  evidence: string[];
}

export interface CanonicalRecommendation {
  id: string;
  title: string;
  priority: string;
  effort: string;
  pillar: string;
  description: string;
  implemented: boolean;
}

export interface DeltaCounts {
  components: number;
  relationships: number;
  boundaries: number;
}

export interface ChangeEntry {
  type: 'added' | 'removed' | 'modified';
  entityType: 'component' | 'relationship' | 'boundary';
  entityId: string;
  label: string;
  reason: string;
}

export interface DeltaRecord {
  fromVersionId?: string;
  added: DeltaCounts;
  removed: DeltaCounts;
  modified: DeltaCounts;
  retained: DeltaCounts;
  changes: ChangeEntry[];
  migrationConsiderations: string[];
}

export interface MutationHistoryEntry {
  mutationId: string;
  timestamp: string;
  trigger: string;
  intent: string;
  description: string;
  resultVersionId: string;
  confidence: number;
  approved: boolean;
  approvedBy: string;
}

export interface RenderHints {
  layoutProfile: string;
  showEdgeLayer: boolean;
  showSecurityBand: boolean;
  showCicdBand: boolean;
  showExternalSystems: boolean;
  maxNodesPerSubnet: number;
  edgeDensity: string;
  colorScheme: string;
}

// ── Main Model ────────────────────────────────────────────────────────

export interface CanonicalArchitectureModel {
  // Identity & Versioning
  modelVersion: string;
  architectureId: string;
  versionId: string;
  parentVersionId?: string;
  workspaceId: string;
  projectId: string;
  createdAt: string;
  createdBy: string;

  // Classification
  mode: ArchitectureMode;
  depthLevel: DepthLevel;
  environmentClass: EnvironmentClass;
  criticalityLevel: CriticalityLevel;
  architectureTemplate: ArchitectureTemplate;
  cloudProvider: string;
  region: string;

  // Context
  context?: ArchitectureContext;
  assumptions: Assumption[];
  openQuestions: OpenQuestion[];

  // Structure
  actors: Actor[];
  externalSystems: ExternalSystem[];
  boundaries: Boundary[];
  zones: Zone[];
  layers: Layer[];
  components: CanonicalComponent[];
  relationships: Relationship[];

  // Cross-Cutting
  securityControls: SecurityControl[];
  observabilityControls: ObservabilityControl[];
  deploymentControls: DeploymentControl[];

  // Strategy
  hadrStrategy?: HADRStrategy;
  scalingStrategy?: ScalingStrategy;

  // Governance
  principlesApplied: PrincipleApplied[];
  recommendations: CanonicalRecommendation[];

  // Delta & History
  delta?: DeltaRecord;
  mutationHistory: MutationHistoryEntry[];

  // Rendering
  renderHints?: RenderHints;
}

// ── Mutation Plan (produced by MutationIntentAgent) ───────────────────

export interface ComponentDef {
  id?: string;
  label: string;
  type: string;
  technology?: string;
  zoneId: string;
  boundaryId?: string;
  iconId?: string;
}

export interface RelationshipDef {
  sourceId: string;
  targetId: string;
  type: string;
  protocol?: string;
  label?: string;
}

export interface BoundaryDef {
  id?: string;
  type: string;
  label: string;
  parentBoundary?: string;
}

export interface ExternalSystemDef {
  id?: string;
  label: string;
  type: string;
  protocol?: string;
}

export interface ReplicateSpec {
  sourceAZ: string;
  targetAZ: string;
  components: string[];
}

export interface MutationAction {
  actionId: string;
  type: MutationActionType;
  order: number;
  rationale: string;
  component?: ComponentDef;
  relationship?: RelationshipDef;
  boundary?: BoundaryDef;
  externalSystem?: ExternalSystemDef;
  replicate?: ReplicateSpec;
  parameters: Record<string, any>;
}

export interface MutationPlan {
  mutationId: string;
  intentType: string;
  description: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  actions: MutationAction[];
  dependencyHints: string[];
  riskFactors: string[];
  rationale: string;
  rollbackPlan: string;
}

// ── Agent Output Schemas ──────────────────────────────────────────────

export interface RequestUnderstanding {
  requestType: string;
  systemType: string;
  systemName: string;
  domain: string;
  goals: string[];
  nfrSignals: {
    scalability: string;
    availability: string;
    latencyTarget: string;
    security: string;
    compliance: string[];
    dataResidency: string;
  };
  inferredServices: { name: string; domain: string; confidence: number }[];
  inferredEntities: string[];
  inferredIntegrations: { name: string; type: string; confidence: number }[];
  inferredEnvironment: string;
  inferredCriticality: string;
  missingInformation: { dimension: string; question: string; severity: string }[];
  confidence: number;
  assumptions: { statement: string; confidence: string; source: string }[];
}

export interface ArchitectureReview {
  overallScore: number;
  overallAssessment: string;
  pillars: {
    pillar: string;
    score: number;
    strengths: string[];
    gaps: string[];
    findings: {
      id: string;
      severity: string;
      title: string;
      description: string;
      recommendation: string;
      effort: string;
      componentIds: string[];
    }[];
  }[];
  enterprisePrinciples: {
    principle: string;
    applied: boolean;
    evidence: string;
    gaps: string[];
  }[];
  topRecommendations: {
    id: string;
    title: string;
    priority: string;
    pillar: string;
  }[];
}

export interface ArchitectureNarrative {
  executiveSummary: string;
  componentGroupSummary: { group: string; components: string[]; description: string }[];
  principlesSummary: string;
  deltaSummary?: {
    changeDescription: string;
    added: string;
    migrationConsiderations: string[];
  };
  tradeoffs: string[];
}

// ── Quality Report (from diagram service) ─────────────────────────────

export interface QualityCheck {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  severity: string;
  details?: string;
  affectedIds: string[];
}

export interface QualityReport {
  passed: boolean;
  score: number;
  checks: QualityCheck[];
  qualityTimeMs: number;
}
