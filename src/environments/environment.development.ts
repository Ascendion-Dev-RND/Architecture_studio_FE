/**
 * Development Environment Configuration
 * 
 * This file contains configuration settings for local development.
 * Tokens are configurable - replace with your development credentials.
 */

export const environment = {
  production: false,
  
  // API Configuration
  api: {
    // Legacy agent API (AAVA)
    baseUrl: 'https://aava-int.avateam.io',
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
    
    // WebSocket for real-time chat
    websocket: {
      chatUrl: 'ws://localhost:8084/ws/chat'
    }
  },
  
  // Authentication Configuration
  // TODO: Replace with your development credentials
  auth: {
    bearerToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJUaWctN1NxQTE3MVFGcjFmTnBxbFFsUklnLU12RTBnSjlaX1dIRWxKMjkwIiwiaWF0IjoxNzY0OTE5NjQ4LCJleHAiOjE3NjQ5MjQ1MDksImF1ZCI6IjAwMDAwMDAzLTAwMDAtMDAwMC1jMDAwLTAwMDAwMDAwMDAwMCIsInRpZCI6ImQ3NzU4ZThmLTFkZjMtNDg5Zi04NmI1LWEyMjU0ZjU1ZjljYyIsImFwcGlkIjoiY2U2Y2M0MjEtYmZjZi00ZGI3LTg3MGEtOTA0ZTc4OGFkYThmIiwidW5pcXVlX25hbWUiOiJiaGFyYXRoLmFAYXNjZW5kaW9uLmNvbSIsImRvbWFpbiI6ImFhdmEtaW50LmF2YXRlYW0uaW8iLCJ1c2VyRGV0YWlscyI6IjgzNnRwbXhxNWVZVWxhdW9IbFV5cjd4cU52bTlOUFQ4dUVJMTJDUmdvcUlURVNSUTJ5c3RtWmMvUGRnb2QwM25nSWFMTkZuT3FDcWZOOWFZNEtGTG1rQ0lzZy9pTWs0MGRrRCtTRVpid2pQcGRpNVFLTjY0V21SVWRFc09QeXpMdXlPK1NRRldmWlVwNFpwSTFzUXJGemYyNFg5b3ZpaVUyYnJPa1hINURldllmdzRBaUJ5Zzc4UUdyTmhiNkE1dEM2RkV2cGV4ZjNkSndsdk9LSVRPaEVxbm56QmNnczZqQWVaUEpaVFMyS2gybFFHNmxOTkZ4a3lHMFlkeWowSEs0N0tZMSt6c2VXWnI0RTFHYnlFT002TTU2NDNtTHM5dnlyRGhESVRyYko4bWdQMlVodDZkelB3dFRGdFFCc3ExM1U4U2Q1WXBrdlJXRk42YkxFMWdoLzI5UkVaVGEyS054YWc0NnV4eHhxM0VVR0tBeStwbmg0RlZpM2NIaXMvak5pUjBBWTdtdGhHWXQ1dTh0Y0g2UVo1TWsrQ0tNNi9DNVNYcGFiMGhuc0o3N1FQZnhma2ZCTExMV3JoREd5QzFuSDZJMGV6SWsxWUpiZjV3a2RJOHIvallaYUlzb3dER000MHVFZHJPN2QvbzBpOWtmZFlLTzVmcGxUY1YvTWFxWHRha3lGalFPRGRjMUFKMlJhTE1jb0E5V0tRYThNU0JjeEczcFNFRng4a0kzbkhWd3ZWdkg2TEJnMngyd2grQ3oxV082MzdoTUNxU2dBR3ZmWVE3MXpROFg4d2NNQlRyd1FqOWIxVGNWa2VVT3ZaZVpDMlJnUHQ0UUg3WWRZVzAxQ2x4SS8vZExOU29nRzhnaHdmS2d4ODJGZG5RdjByMFJvQWVlUzM2Tk1Pc1UrNTYzNGxETHYxMmZWQTVBK0VCU0FIRlJ3akZNT1VEQ0M0aTdFY1JBci8zTTNHajJwYmRUTVhGUTFBcXdtcWJIamZZdWNGZTluVk83Ti9Gb21OQ3hscGJMZWRaY3NhYlV5cEhRWndidVlkeThMQnpiTWpHK2E3aG8zcmMvOVU1bWRwWHhPQVZ0VVpDRitMVTVuUmdJRVIxU2t5NHdEZ0VCeHlwRlNCdTdEblJ6T0ZJMjViL1RveGx0NGllSXdrdi9jR3ZrTkZtSzFicTk2Uk1mYXlmcnlONlNObFJ6QWhpZG5IWUR0WVFGZk11ZTFRV3NNTmVjamtqUW1ET0VUM0dNNVR3U2tKd0d1L1ZWQlRHaUNxdXYyYk9RY09SYTBhNjIycUpPZFRLN3dWdU1zaG5qSlhRQ3FwSjVwSVowWXQwNEpaWktvMHl3S2t0WEM2L0o2ajVtSmE1R3g1Y1NsT3MxcjFzMFk4NnRsR0UvUURKdk0wb29Cb256cVpKbmRYS1pEYjZvSzVqdXFrRHA0ZG5QNU45bmNqK2pTZlFCazF4Zjloc1lPclZQdmpZWmFJc293REdNNDB1RWRyTzdkL28waTlrZmRZS081ZnBsVGNWL01hcVh0YWt5RmpRT0RkYzFBSjJSYUxNY29BOVdLUWE4TVNCY3hHM3BTRUZ4OGwxOUp6bkltZEplWkt5NFhyWGI1ZUp0Y1FkMEl6cm1iZyt5NG1UN2FNL0lZMnVubVB3b0EvVGRGOVk4bzRnVWZOVWxqS0pSVzVXU2FlNjA1TEs2ZVFxcjNaaFAxTm95blNUT2dnS1grOUlIUHlwRExsU2lpTy9kNWRiWnFtempWSmJKSWoza1BpUGJJVVI3SG03K3Y0TWphNmVZL0NnRDlOMFgxanlqaUJSODhRS2JUTnNjY3ZJVDFUNnpMVzNwTTZhWndZRkZhUnNzcGEwMzdyeXp3dyt3eWg3TFMwazREOXF0NDh6UkZBTWVhZFZIeU1tSFREVTIvTnltaC8zQ0NvTDRqYytjZ3B3aCtUWUtpUG1yZGx6In0.fyzEguKNu4y7pd8sr75D_8TCxcj_qHjaGZLvH5PO38puULU8YwCiFLMPO6Q6HIiyNKzlwjYqC5p-wH4iMWebCtRqXD6ssNLYyvH6uSNG4ninEspnnH0Gx6oS0y18PiZC6pcZ73tu2pviJFLd4ZfACgNDWUmZlECxm3mkJH22kNXEZl7XS9CEFMl14n3NvXBm9888XS_5xj0-7fvArC51iAMR6cWvqUdP99mBtS2WCyfqTywl_hHnCHBa0zyvPZErRw3S-18eYRQLuEFgPpiQdtENOPWtylYmSW9mXpaVNM4M2sakhcuOuKZegBBZCoFwwUfBWoQM4-sWNrPDlNzwLA',
    username: 'bharath.a@ascendion.com'
  },
  
  // Agent Configuration
  agent: {
    defaultAgentId: 8773,
    timeout: 300000 // 5 minutes
  }
};
