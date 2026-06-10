import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AgentService } from './agent.service';
import { AgentExecuteRequest, AgentExecuteResponse, ExecutionStatus } from '../models/agent.model';
import { environment } from '../../environments/environment';

describe('AgentService', () => {
  let service: AgentService;
  let httpMock: HttpTestingController;
  const agentExecuteUrl = `${environment.api.baseUrl}${environment.api.endpoints.agentExecute}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AgentService]
    });
    service = TestBed.inject(AgentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should execute architecture generator', () => {
    const mockResponse: AgentExecuteResponse = {
      executionId: 'test-id',
      status: ExecutionStatus.COMPLETED,
      result: { architecture: 'generated' }
    };

    service.executeArchitectureGenerator({ prompt: 'Generate architecture' })
      .subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

    const req = httpMock.expectOne(agentExecuteUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toContain('Bearer');
    expect(req.request.headers.get('Content-Type')).toBe('application/json');
    req.flush(mockResponse);
  });

  it('should execute architecture assessment', () => {
    const mockResponse: AgentExecuteResponse = {
      executionId: 'test-id-2',
      status: ExecutionStatus.COMPLETED
    };

    service.executeArchitectureAssessment({
      prompt: 'Assess architecture',
      selectedOptions: ['TOGAF', 'Security'],
      assessmentDepth: 'standard'
    }).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(agentExecuteUrl);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should execute E2E system design', () => {
    const mockResponse: AgentExecuteResponse = {
      executionId: 'test-id-3',
      status: ExecutionStatus.COMPLETED
    };

    service.executeE2ESystemDesign({
      prompt: 'Design system',
      requirements: ['High availability', 'Scalability']
    }).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(agentExecuteUrl);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should handle HTTP errors', () => {
    service.executeArchitectureGenerator({ prompt: 'Test' })
      .subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('Server Error');
        }
      });

    const req = httpMock.expectOne(agentExecuteUrl);
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });

  it('should generate unique execution IDs', () => {
    const request1 = { prompt: 'Test 1' };
    const request2 = { prompt: 'Test 2' };

    service.executeArchitectureGenerator(request1).subscribe();
    service.executeArchitectureGenerator(request2).subscribe();

    const requests = httpMock.match(agentExecuteUrl);
    expect(requests.length).toBe(2);
    expect(requests[0].request.body.executionId).toBeTruthy();
    expect(requests[1].request.body.executionId).toBeTruthy();
    expect(requests[0].request.body.executionId).not.toBe(requests[1].request.body.executionId);

    requests.forEach(req => req.flush({ executionId: 'test', status: ExecutionStatus.COMPLETED }));
  });

  it('should get configuration', () => {
    const config = service.getConfiguration();
    expect(config.baseUrl).toBe(environment.api.baseUrl);
    expect(config.username).toBeDefined();
    expect(config.hasToken).toBeDefined();
    expect(config.defaultAgentId).toBe(environment.agent.defaultAgentId);
  });

  it('should execute custom agent', () => {
    const customInputs = { customField: 'value' };
    const mockResponse: AgentExecuteResponse = {
      executionId: 'custom-id',
      status: ExecutionStatus.COMPLETED
    };

    service.executeCustomAgent(9999, customInputs).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(agentExecuteUrl);
    expect(req.request.body.agentId).toBe(9999);
    expect(req.request.body.userInputs).toEqual(customInputs);
    req.flush(mockResponse);
  });
});
