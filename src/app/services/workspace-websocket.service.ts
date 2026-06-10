/**
 * WorkspaceWebSocketService — Real-time WebSocket connection for workspace sessions.
 *
 * Manages a single WebSocket connection per workspace, handles reconnection,
 * session initialization, and exposes typed event observables that the workspace
 * component subscribes to for streaming chat, artifact updates, and progress.
 *
 * Event types (server → client):
 *   session_started, agent_thinking, architecture_update_started,
 *   architecture_update_completed, message_stream, overview_regenerated,
 *   diagram_regenerated, code_regenerated, error, pong
 */
import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, timer, Subscription, BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ── Typed WS events ──────────────────────────────────────────────────────────

export interface WsEvent {
  type: string;
  [key: string]: any;
}

export interface WsEditResult {
  type: string;
  intentType: string;
  requestedChangeSummary?: string;
  modificationPlan?: string[];
  updatedArchitectureModel?: any;
  updatedOverview?: any;
  updatedDiagramCode?: string;
  userFacingSummary?: string;
  chatMessages?: any[];
  clarificationNeeded?: any;
  status?: string;
}

export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class WorkspaceWebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private workspaceId: string = '';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectBaseDelay = 1000; // ms
  private reconnectSub: Subscription | null = null;
  private pingInterval: any = null;

  // All raw events
  private eventSubject = new Subject<WsEvent>();
  public events$: Observable<WsEvent> = this.eventSubject.asObservable();

  // Connection state
  private connectionStateSubject = new BehaviorSubject<WsConnectionState>('disconnected');
  public connectionState$ = this.connectionStateSubject.asObservable();

  // Convenience filtered streams
  public sessionStarted$ = this.events$.pipe(filter(e => e.type === 'session_started'));
  public agentThinking$ = this.events$.pipe(filter(e => e.type === 'agent_thinking'));
  public architectureUpdateStarted$ = this.events$.pipe(filter(e => e.type === 'architecture_update_started'));
  public architectureUpdateCompleted$ = this.events$.pipe(
    filter(e => e.type === 'architecture_update_completed'),
    map(e => e as WsEditResult)
  );
  public messageStream$ = this.events$.pipe(filter(e => e.type === 'message_stream'));
  public overviewRegenerated$ = this.events$.pipe(filter(e => e.type === 'overview_regenerated'));
  public diagramRegenerated$ = this.events$.pipe(filter(e => e.type === 'diagram_regenerated'));
  public codeRegenerated$ = this.events$.pipe(filter(e => e.type === 'code_regenerated'));
  public errors$ = this.events$.pipe(filter(e => e.type === 'error'));

  constructor() {
    console.log('[WS] WorkspaceWebSocketService initialized');
  }

  /** Get the current connection state */
  get connectionState(): WsConnectionState {
    return this.connectionStateSubject.value;
  }

  /** Get the current workspace ID */
  get currentWorkspaceId(): string {
    return this.workspaceId;
  }

  /**
   * Connect to the workspace WebSocket and initialize session.
   * If already connected to the same workspace, no-op.
   * If connected to a different workspace, disconnect first.
   */
  connect(workspaceId: string): void {
    if (this.ws && this.workspaceId === workspaceId && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected to workspace:', workspaceId);
      return;
    }

    // Disconnect from previous workspace if any
    if (this.ws) {
      this.disconnect();
    }

    this.workspaceId = workspaceId;
    this.reconnectAttempts = 0;
    this._connect();
  }

  /**
   * Send a chat message through the WebSocket.
   */
  sendChatMessage(message: string, currentDiagramSpec?: any, cloudProvider?: string, attachmentContext?: any): void {
    this._send({
      type: 'chat',
      workspaceId: this.workspaceId,
      message,
      currentDiagramSpec: currentDiagramSpec || null,
      cloudProvider: cloudProvider || 'aws',
      diagramType: 'cloud-architecture',
      attachmentContext: attachmentContext || null,
    });
  }

  /**
   * Send an action confirmation (e.g., for destructive changes).
   */
  sendAction(pendingActionId: string, choice: string): void {
    this._send({
      type: 'action',
      workspaceId: this.workspaceId,
      pendingActionId,
      choice,
    });
  }

  /**
   * Disconnect and clean up.
   */
  disconnect(): void {
    this._stopPing();
    this._stopReconnect();
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect on intentional close
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.connectionStateSubject.next('disconnected');
    console.log('[WS] Disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.eventSubject.complete();
    this.connectionStateSubject.complete();
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _connect(): void {
    this.connectionStateSubject.next(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const wsBaseUrl = this._getWsUrl();
    const url = `${wsBaseUrl}/ws/chat`;
    console.log(`[WS] Connecting to ${url} (attempt ${this.reconnectAttempts + 1})`);

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.connectionStateSubject.next('connected');
      this.reconnectAttempts = 0;
      this._startPing();

      // Initialize session
      this._send({ type: 'session_init', workspaceId: this.workspaceId });
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data: WsEvent = JSON.parse(event.data);
        this.eventSubject.next(data);
      } catch (err) {
        console.warn('[WS] Failed to parse message:', event.data);
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      console.log(`[WS] Closed: code=${event.code}, reason=${event.reason}`);
      this._stopPing();
      if (event.code !== 1000) {
        // Abnormal close — attempt reconnect
        this._scheduleReconnect();
      } else {
        this.connectionStateSubject.next('disconnected');
      }
    };

    this.ws.onerror = (event: Event) => {
      console.error('[WS] Error:', event);
    };
  }

  private _send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Cannot send — not connected. Queuing not implemented.');
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[WS] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      this.connectionStateSubject.next('disconnected');
      this.eventSubject.next({ type: 'error', message: 'WebSocket connection lost. Please refresh the page.' });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.connectionStateSubject.next('reconnecting');

    this._stopReconnect();
    this.reconnectSub = timer(delay).subscribe(() => {
      this._connect();
    });
  }

  private _stopReconnect(): void {
    if (this.reconnectSub) {
      this.reconnectSub.unsubscribe();
      this.reconnectSub = null;
    }
  }

  private _startPing(): void {
    this._stopPing();
    this.pingInterval = setInterval(() => {
      this._send({ type: 'ping' });
    }, 30000); // 30s keep-alive
  }

  private _stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private _getWsUrl(): string {
    // Derive WebSocket URL from the architecture service URL
    const archUrl = (environment.api as any).architectureServiceUrl || 'http://localhost:8084';
    return archUrl.replace(/^http/, 'ws');
  }
}
