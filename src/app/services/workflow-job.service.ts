import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WorkspaceJobStartResponse {
  jobId: string;
  workspaceId: string;
  jobType: string;
  status: string;
  streamUrl: string;
  statusUrl: string;
}

export interface WorkspaceJobEvent {
  jobId: string;
  workspaceId: string;
  jobType: string;
  eventType: string;
  status: string;
  stage: string;
  message: string;
  percent?: number | null;
  timestamp: string;
  details?: Record<string, any>;
  artifactCount?: number | null;
  clarificationCount?: number | null;
}

export interface WorkspaceJobUpdate<T = any> {
  kind: 'started' | 'event' | 'completed' | 'clarification_required';
  start: WorkspaceJobStartResponse;
  event?: WorkspaceJobEvent;
  result?: T;
}

@Injectable({ providedIn: 'root' })
export class WorkflowJobService {
  private readonly baseUrl = (environment.api as any).architectureServiceUrl || environment.api.backendUrl || '';

  constructor(private http: HttpClient) {}

  startJob(startUrl: string, body: any): Observable<WorkspaceJobStartResponse> {
    return this.http.post<WorkspaceJobStartResponse>(this.resolveUrl(startUrl), body).pipe(
      timeout(300000)
    );
  }

  runJob<T = any>(startUrl: string, body: any): Observable<WorkspaceJobUpdate<T>> {
    return this.startJob(startUrl, body).pipe(
      switchMap(start => this.openStream<T>(start))
    );
  }

  private openStream<T>(start: WorkspaceJobStartResponse): Observable<WorkspaceJobUpdate<T>> {
    return new Observable<WorkspaceJobUpdate<T>>(observer => {
      let terminal = false;
      const source = new EventSource(this.resolveUrl(start.streamUrl));

      observer.next({ kind: 'started', start });

      const handlePayload = (payload: WorkspaceJobEvent) => {
        observer.next({ kind: 'event', start, event: payload });

        if (payload.eventType === 'job_completed') {
          terminal = true;
          observer.next({
            kind: 'completed',
            start,
            event: payload,
            result: payload.details?.['result'] as T,
          });
          source.close();
          observer.complete();
          return;
        }

        if (payload.eventType === 'clarification_required') {
          terminal = true;
          observer.next({
            kind: 'clarification_required',
            start,
            event: payload,
            result: payload.details?.['result'] as T,
          });
          source.close();
          observer.complete();
          return;
        }

        if (payload.eventType === 'job_failed') {
          terminal = true;
          source.close();
          // Preserve the structured details (findings, errorClass) so the
          // workspace can render specific validation codes instead of the
          // aggregate "X error(s), Y warning(s)". Wrap in an Error so
          // RxJS error handlers keep working with .message; attach the
          // raw details on a custom property.
          const message = (payload.details?.['error'] as string)
              || payload.message
              || 'Workflow job failed';
          const err: any = new Error(message);
          err.details = payload.details || {};
          err.eventType = payload.eventType;
          err.stage = payload.stage;
          observer.error(err);
        }
      };

      const parseAndHandle = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as WorkspaceJobEvent;
          handlePayload(payload);
        } catch (error) {
          observer.error(error);
        }
      };

      source.onmessage = parseAndHandle;
      [
        'job_started',
        'step_started',
        'step_progress',
        'step_completed',
        'warning',
        'clarification_required',
        'job_completed',
        'job_failed',
      ].forEach(eventName => source.addEventListener(eventName, parseAndHandle as EventListener));

      source.onerror = () => {
        if (terminal) {
          return;
        }
        this.http.get<any>(this.resolveUrl(start.statusUrl)).pipe(timeout(10000)).subscribe({
          next: status => {
            const normalized = String(status?.status || '').toLowerCase();
            if (normalized === 'completed') {
              terminal = true;
              observer.next({ kind: 'completed', start, result: status?.result as T });
              source.close();
              observer.complete();
              return;
            }
            if (normalized === 'needs_clarification') {
              terminal = true;
              observer.next({ kind: 'clarification_required', start, result: status?.result as T });
              source.close();
              observer.complete();
              return;
            }
            if (normalized === 'failed') {
              terminal = true;
              source.close();
              observer.error(status?.error || 'Workflow job failed');
              return;
            }
            source.close();
            observer.error('Live progress connection lost');
          },
          error: () => {
            source.close();
            observer.error('Live progress connection lost');
          },
        });
      };

      return () => source.close();
    });
  }

  private resolveUrl(url: string): string {
    if (!url) {
      return this.baseUrl;
    }
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    return `${this.baseUrl}${url}`;
  }
}
