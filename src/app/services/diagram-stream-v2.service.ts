/**
 * DiagramStreamV2Service — WebSocket client for the diagram-service v2
 * live-preview channels (LLD §B.5).
 *
 * <p>Two channels:
 * <ul>
 *   <li><b>compile</b> — `ws://…/v2/stream/compile/{traceId}` — frames
 *       emitted by `POST /v2/compile` (pattern-matched → overrides-applied →
 *       lanes-pinned → region-laid-out* → edges-routed → geometry-final →
 *       final-with-svg).</li>
 *   <li><b>edit</b> — `ws://…/v2/stream/edit/{ws}/{id}` — same shape, fired
 *       by `POST /v2/edit`.</li>
 * </ul>
 *
 * <p>Both honour:
 * <ul>
 *   <li>{@code Last-Event-Id} header — automatic, set from the highest seq
 *       observed before disconnect, so reconnect resumes without dupes.</li>
 *   <li>{@code ping} / {@code pong} — sent every 30s; idle WebSockets get
 *       cleaned up by NAT and Cloud LBs otherwise.</li>
 *   <li>{@code cancel} — client-initiated graceful close.</li>
 * </ul>
 */
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface V2StreamFrame {
  type: 'phase' | 'error' | 'complete' | 'pong';
  phase?: string;
  seq: number;
  data?: any;
  code?: string;
  message?: string;
  stage?: string;
  ts?: number;
}

export type V2StreamState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface ChannelHandle {
  url: string;
  ws: WebSocket;
  lastSeq: number;
  reconnectAttempts: number;
  reconnectTimer: any;
  pingTimer: any;
  framesSubject: Subject<V2StreamFrame>;
  stateSubject: BehaviorSubject<V2StreamState>;
  manuallyClosed: boolean;
}

@Injectable({ providedIn: 'root' })
export class DiagramStreamV2Service implements OnDestroy {
  private readonly channels = new Map<string, ChannelHandle>();
  private readonly maxReconnect = 5;
  private readonly reconnectBaseMs = 1000;
  private readonly pingIntervalMs = 30000;

  /** Open (or reuse) the compile-stream channel for the given trace id. */
  openCompile(traceId: string): Observable<V2StreamFrame> {
    return this.openChannel(`compile:${traceId}`,
        `${this.wsBase()}/v2/stream/compile/${encodeURIComponent(traceId)}`);
  }

  /** Open (or reuse) the edit-stream channel for the given diagram. */
  openEdit(workspaceId: string, diagramId: string): Observable<V2StreamFrame> {
    return this.openChannel(`edit:${workspaceId}/${diagramId}`,
        `${this.wsBase()}/v2/stream/edit/${encodeURIComponent(workspaceId)}/${encodeURIComponent(diagramId)}`);
  }

  /** Connection state for a given channel key. */
  stateOf(key: string): Observable<V2StreamState> {
    const ch = this.channels.get(key);
    return ch ? ch.stateSubject.asObservable() : new BehaviorSubject<V2StreamState>('idle');
  }

  /** Gracefully close one channel (sends a {@code cancel} control frame). */
  close(key: string): void {
    const ch = this.channels.get(key);
    if (!ch) return;
    ch.manuallyClosed = true;
    try { ch.ws.send(JSON.stringify({ type: 'cancel' })); } catch { /* ignore */ }
    this.teardown(ch);
    this.channels.delete(key);
  }

  ngOnDestroy(): void {
    Array.from(this.channels.keys()).forEach(k => this.close(k));
  }

  // ── internals ─────────────────────────────────────────────────────────

  private openChannel(key: string, url: string): Observable<V2StreamFrame> {
    const existing = this.channels.get(key);
    if (existing && existing.ws.readyState <= WebSocket.OPEN) {
      return existing.framesSubject.asObservable();
    }
    const handle: ChannelHandle = {
      url,
      ws: null as any,
      lastSeq: 0,
      reconnectAttempts: 0,
      reconnectTimer: null,
      pingTimer: null,
      framesSubject: new Subject<V2StreamFrame>(),
      stateSubject: new BehaviorSubject<V2StreamState>('idle'),
      manuallyClosed: false
    };
    this.channels.set(key, handle);
    this.connect(handle);
    return handle.framesSubject.asObservable();
  }

  private connect(ch: ChannelHandle): void {
    ch.stateSubject.next('connecting');
    // The browser WebSocket API can't set arbitrary headers, but server
    // honours Last-Event-Id via query string as a fallback.
    const url = ch.lastSeq > 0
        ? `${ch.url}?lastEventId=${ch.lastSeq}`
        : ch.url;
    try {
      ch.ws = new WebSocket(url);
    } catch (err) {
      console.error('[diagram-stream-v2] failed to create ws:', err);
      this.scheduleReconnect(ch);
      return;
    }

    ch.ws.onopen = () => {
      ch.stateSubject.next('open');
      ch.reconnectAttempts = 0;
      ch.pingTimer = setInterval(() => {
        try { ch.ws.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
      }, this.pingIntervalMs);
    };

    ch.ws.onmessage = (msg) => {
      let frame: V2StreamFrame;
      try {
        frame = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (frame.seq && frame.seq > ch.lastSeq) ch.lastSeq = frame.seq;
      ch.framesSubject.next(frame);
    };

    ch.ws.onclose = () => {
      this.clearPing(ch);
      if (ch.manuallyClosed) {
        ch.stateSubject.next('closed');
      } else {
        this.scheduleReconnect(ch);
      }
    };

    ch.ws.onerror = () => {
      ch.stateSubject.next('error');
    };
  }

  private scheduleReconnect(ch: ChannelHandle): void {
    if (ch.reconnectAttempts >= this.maxReconnect) {
      ch.stateSubject.next('error');
      ch.framesSubject.next({
        type: 'error', seq: ch.lastSeq + 1,
        code: 'WS_GIVEUP',
        message: `WebSocket disconnected after ${this.maxReconnect} attempts.`,
        stage: 'stream'
      });
      return;
    }
    ch.reconnectAttempts += 1;
    const delay = this.reconnectBaseMs * Math.pow(2, ch.reconnectAttempts - 1);
    ch.stateSubject.next('connecting');
    ch.reconnectTimer = setTimeout(() => this.connect(ch), delay);
  }

  private teardown(ch: ChannelHandle): void {
    this.clearPing(ch);
    if (ch.reconnectTimer) { clearTimeout(ch.reconnectTimer); ch.reconnectTimer = null; }
    if (ch.ws && ch.ws.readyState <= WebSocket.OPEN) {
      try { ch.ws.close(1000, 'client close'); } catch { /* ignore */ }
    }
    ch.framesSubject.complete();
    ch.stateSubject.complete();
  }

  private clearPing(ch: ChannelHandle): void {
    if (ch.pingTimer) { clearInterval(ch.pingTimer); ch.pingTimer = null; }
  }

  private wsBase(): string {
    const ds: any = (environment.api as any).diagramServiceV2;
    return (ds && ds.directWsBase) || 'ws://localhost:8086';
  }
}
