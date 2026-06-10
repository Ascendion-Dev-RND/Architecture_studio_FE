/**
 * Production Environment Configuration
 * 
 * This file contains configuration settings for production deployment.
 * DO NOT commit sensitive tokens to version control.
 */

export const environment = {
  production: true,
  
  // API Configuration
  api: {
    // Legacy agent API (AAVA)
    baseUrl: '',  // Empty for nginx proxy
    endpoints: {
      agentExecute: '/agents/execute'
    },
    
    // New backend API (Agentic Architecture Studio)
    backendUrl: 'http://localhost:8000',
    backendEndpoints: {
      // Architecture Generation
      architectureGenerate: '/api/v1/architecture/generate',
      architectureTasks: '/api/v1/architecture/tasks',
      diagramTypes: '/api/v1/architecture/diagram-types',
      
      // Architecture Assessment
      assessmentAnalyze: '/api/v1/assessment/analyze',
      assessmentTasks: '/api/v1/assessment/tasks',
      assessmentOptions: '/api/v1/assessment/options',
      
      // E2E System Design
      e2eDesign: '/api/v1/e2e/design',
      e2eTasks: '/api/v1/e2e/tasks',
      e2eTemplates: '/api/v1/e2e/templates'
    },
    
    // Agent Service (Python)
    agentServiceUrl: 'http://localhost:8001',
    agentServiceEndpoints: {
      tasks: '/api/v1/agents/tasks',
      workspaces: '/api/v1/workspaces',
      diagrams: '/api/v1/diagrams',
      review: '/api/v1/review',
      e2eDesign: '/api/v1/design/e2e-design'
    },
    
    // New Microservices
    architectureServiceUrl: 'http://localhost:8084',
    architectureServiceEndpoints: {
      generate: '/api/v1/architecture/generate',
      tasks: '/api/v1/architecture/tasks',
      diagramTypes: '/api/v1/architecture/diagram-types',
      chat: '/api/v1/architecture/chat',
      projects: '/api/v1/projects',
      discovery: '/api/v1/discovery/analyze',
      discoveryClarify: '/api/v1/discovery/clarify',
      assessment: '/api/v1/assessment/analyze',
      e2eDesign: '/api/v1/e2e-design/generate',
      health: '/api/v1/health'
    },
    diagramServiceUrl: 'http://localhost:8082',
    iconServiceUrl: 'http://localhost:8083',

    // Diagram service v2 (LLD §B.5) — server-rendered SVG/drawio + live preview.
    // FE talks to the BFF compose layer for HTTP and to v2 directly for WebSockets.
    // Container topology: architecture-service exposes /api/v2/diagram on host
    // port 8084; diagram-service-v2 exposes its WebSocket on host port 8092.
    diagramServiceV2: {
      composeBase: 'http://localhost:8084/api/v2/diagram',
      directWsBase: 'ws://localhost:8092'
    },
    
    // WebSocket for real-time chat
    websocket: {
      chatUrl: '/ws/chat'
    }
  },
  
  // Authentication Configuration
  // IMPORTANT: Replace these with environment variables or secure vault in production
  auth: {
    bearerToken: '', // Set via environment variable: AGENT_BEARER_TOKEN
    username: '' // Set via environment variable: AGENT_USERNAME
  },
  
  // Agent Configuration
  agent: {
    defaultAgentId: 8773,
    timeout: 300000 // 5 minutes
  }
};
