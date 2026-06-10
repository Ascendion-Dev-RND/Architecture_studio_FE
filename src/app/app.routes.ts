import { Routes } from '@angular/router';

/**
 * Application Routes
 * 
 * Route Structure:
 * - "/" - Landing page with hero, features, and projects
 * - "/architecture-generator" - Input page for architecture generation
 * - "/architecture-workspace" - Interactive workspace with chat and canvas
 * - "/architecture-assessment" - Input page for architecture assessment
 * - "/assessment-options" - Options selection for assessment
 * - "/architecture-assessment-report" - Detailed assessment report
 * - "/solution-blueprint" - Input page for Solution Blueprint
 * - "/blueprint-clarification" - Clarification page for technical details
 * - "/solution-blueprint-output" - Solution Blueprint output document
 * - "**" - 404 Not Found fallback (redirects to home)
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    title: 'Architecture Studio - AI-Powered Architecture Design'
  },
  {
    path: 'architecture-generator',
    loadComponent: () => import('./pages/architecture-generator/architecture-generator.component')
      .then(m => m.ArchitectureGeneratorComponent),
    title: 'Architecture Generator - Architecture Studio'
  },
  {
    path: 'architecture-workspace',
    loadComponent: () => import('./pages/architecture-workspace/architecture-workspace.component')
      .then(m => m.ArchitectureWorkspaceComponent),
    title: 'Architecture Workspace - Architecture Studio'
  },
  {
    path: 'architecture-assessment',
    loadComponent: () => import('./pages/architecture-assessment/architecture-assessment.component')
      .then(m => m.ArchitectureAssessmentComponent),
    title: 'Architecture Assessment - Architecture Studio'
  },
  {
    path: 'assessment-workspace',
    loadComponent: () => import('./pages/assessment-workspace/assessment-workspace.component')
      .then(m => m.AssessmentWorkspaceComponent),
    title: 'Assessment Workspace - Architecture Studio'
  },
  {
    path: 'assessment-options',
    loadComponent: () => import('./pages/assessment-options/assessment-options.component')
      .then(m => m.AssessmentOptionsComponent),
    title: 'Assessment Options - Architecture Studio'
  },
  {
    path: 'architecture-assessment-report',
    loadComponent: () => import('./pages/architecture-assessment-report/architecture-assessment-report.component')
      .then(m => m.ArchitectureAssessmentReportComponent),
    title: 'Assessment Report - Architecture Studio'
  },
  {
    path: 'solution-blueprint',
    loadComponent: () => import('./pages/e2e-system-design/e2e-system-design.component')
      .then(m => m.E2ESystemDesignComponent),
    title: 'Solution Blueprint - Architecture Studio'
  },
  {
    path: 'solution-blueprint-workspace',
    loadComponent: () => import('./pages/solution-blueprint-workspace/solution-blueprint-workspace.component')
      .then(m => m.SolutionBlueprintWorkspaceComponent),
    title: 'Solution Blueprint Workspace - Architecture Studio'
  },
  {
    path: 'blueprint-clarification',
    loadComponent: () => import('./pages/blueprint-clarification/blueprint-clarification.component')
      .then(m => m.BlueprintClarificationComponent),
    title: 'Blueprint Clarifications - Architecture Studio'
  },
  {
    path: 'solution-blueprint-output',
    loadComponent: () => import('./pages/e2e-system-design-output/e2e-system-design-output.component')
      .then(m => m.E2ESystemDesignOutputComponent),
    title: 'Solution Blueprint - Architecture Studio'
  },
  {
    path: 'modernization',
    loadComponent: () => import('./pages/modernization-home/modernization-home.component')
      .then(m => m.ModernizationHomeComponent),
    title: 'Modernization Platform - Architecture Studio'
  },
  {
    path: 'modernization/discovery',
    loadComponent: () => import('./pages/modernization-discovery/modernization-discovery.component')
      .then(m => m.ModernizationDiscoveryComponent),
    title: 'Modernization Discovery - Architecture Studio'
  },
  {
    path: 'modernization/options',
    loadComponent: () => import('./pages/modernization-options/modernization-options.component')
      .then(m => m.ModernizationOptionsComponent),
    title: 'Modernization Options - Architecture Studio'
  },
  {
    path: 'artifact-hub',
    loadComponent: () => import('./pages/artifact-hub/artifact-hub.component')
      .then(m => m.ArtifactHubComponent),
    title: 'Artifact Hub - Architecture Studio'
  },
  {
    path: 'artifact-hub/workspace',
    loadComponent: () => import('./pages/artifact-hub-workspace/artifact-hub-workspace.component')
      .then(m => m.ArtifactHubWorkspaceComponent),
    title: 'Artifact Workspace - Architecture Studio'
  },
  {
    // Direct tester for the new agent-driven /compile-from-prompt path
    // (LLD §11.4 / agent-review §3.1). Hidden from main nav — open
    // /v2-sandbox in the address bar.
    path: 'v2-sandbox',
    loadComponent: () => import('./pages/v2-sandbox/v2-sandbox.component')
      .then(m => m.V2SandboxComponent),
    title: 'v2 IntentGraph Sandbox - Architecture Studio'
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];
