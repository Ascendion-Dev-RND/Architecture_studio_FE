/**
 * DiagramInteractivityService — installs the global `window.sendPrompt`
 * hook used by the server-emitted SVG (LLD §B.5, §16 — interactivity).
 *
 * <p>SvgAdapterV2 emits `<g>` elements with `data-entity-id`, `data-kind`
 * and `onclick="sendPrompt('Tell me more about the &lt;Label&gt; database')"`
 * — calling this hook routes the prompt into the in-app chat input or
 * directly into the chat WebSocket.
 *
 * <p>Consumers register a handler via {@link #registerPromptHandler}; the
 * service also exposes an Observable of click events for components that
 * want to wire other behaviours (e.g. highlight in the canvas).
 */
import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface DiagramPromptEvent {
  prompt: string;
  source: 'svg-click' | 'svg-keyboard';
  entityId?: string;
  kind?: string;
}

type PromptHandler = (prompt: string, evt?: DiagramPromptEvent) => void;

@Injectable({ providedIn: 'root' })
export class DiagramInteractivityService implements OnDestroy {
  private readonly promptSubject = new Subject<DiagramPromptEvent>();
  public readonly prompts$: Observable<DiagramPromptEvent> = this.promptSubject.asObservable();
  private handler: PromptHandler | null = null;
  private installed = false;

  constructor() {
    this.install();
  }

  /**
   * Register the in-app callback. The most recent registration wins —
   * components can call this in {@code ngOnInit} and unregister via
   * {@link #unregisterPromptHandler} in {@code ngOnDestroy}.
   */
  registerPromptHandler(fn: PromptHandler): void {
    this.handler = fn;
  }

  unregisterPromptHandler(fn: PromptHandler): void {
    if (this.handler === fn) this.handler = null;
  }

  /**
   * Programmatic entry-point — same code path as {@code window.sendPrompt}
   * for tests / synthetic events.
   */
  dispatch(prompt: string, evt?: Partial<DiagramPromptEvent>): void {
    const event: DiagramPromptEvent = {
      prompt,
      source: evt?.source ?? 'svg-click',
      entityId: evt?.entityId,
      kind: evt?.kind,
    };
    this.promptSubject.next(event);
    if (this.handler) {
      try { this.handler(prompt, event); }
      catch (err) { console.error('[diagram-interactivity] handler error:', err); }
    } else if (typeof console !== 'undefined') {
      console.info('[diagram-interactivity] no handler registered; prompt =', prompt);
    }
  }

  ngOnDestroy(): void {
    this.promptSubject.complete();
    this.uninstall();
  }

  // ── internals ───────────────────────────────────────────────────────

  private install(): void {
    if (this.installed || typeof window === 'undefined') return;
    (window as any).sendPrompt = (prompt: string, ctx?: any) => {
      const ev: Partial<DiagramPromptEvent> = ctx && typeof ctx === 'object'
          ? { entityId: ctx.entityId, kind: ctx.kind, source: 'svg-click' }
          : {};
      this.dispatch(prompt, ev);
    };
    this.installed = true;
  }

  private uninstall(): void {
    if (!this.installed || typeof window === 'undefined') return;
    try { delete (window as any).sendPrompt; }
    catch { (window as any).sendPrompt = undefined; }
    this.installed = false;
  }
}
