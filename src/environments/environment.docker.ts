/**
 * Docker Environment Configuration
 * 
 * This file contains configuration settings for Docker deployment.
 * API calls are proxied through nginx to internal services.
 */

export const environment = {
  production: true,
  
  // API Configuration - All requests go through nginx proxy
  api: {
    // Legacy agent API (AAVA)
    baseUrl: '',  // Empty means same origin (nginx proxies)
    endpoints: {
      agentExecute: '/agents/execute'
    },
    
    // Backend API (proxied through nginx)
    backendUrl: '',  // Same origin - nginx proxies to backend
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
    
    // Agent Service (proxied through nginx)
    agentServiceUrl: '',  // Same origin - nginx proxies to agents
    agentServiceEndpoints: {
      tasks: '/agents/api/v1/agents/tasks',
      workspaces: '/agents/api/v1/workspaces',
      diagrams: '/agents/api/v1/diagrams',
      review: '/agents/api/v1/review',
      e2eDesign: '/agents/api/v1/design/e2e-design'
    },
    
    // New Microservices (proxied through nginx)
    architectureServiceUrl: '',
    architectureServiceEndpoints: {
      generate: '/arch/api/v1/architecture/generate',
      tasks: '/arch/api/v1/architecture/tasks',
      diagramTypes: '/arch/api/v1/architecture/diagram-types',
      chat: '/arch/api/v1/architecture/chat',
      projects: '/arch/api/v1/projects',
      discovery: '/arch/api/v1/discovery/analyze',
      discoveryClarify: '/arch/api/v1/discovery/clarify',
      assessment: '/arch/api/v1/assessment/analyze',
      e2eDesign: '/arch/api/v1/e2e-design/generate',
      health: '/arch/api/v1/health'
    },
    diagramServiceUrl: '',
    iconServiceUrl: '',
    
    // WebSocket for real-time chat
    websocket: {
      chatUrl: '/ws/chat'
    }
  },
  
  // Authentication Configuration
  auth: {
    bearerToken: '',
    username: ''
  },
  
  // Agent Configuration
  agent: {
    defaultAgentId: 8773,
    timeout: 300000 // 5 minutes
  }
};
