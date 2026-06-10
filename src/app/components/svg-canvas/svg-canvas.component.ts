import {
  AfterViewInit, Component, ElementRef, EventEmitter,
  Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DiagramStreamV2Service, V2StreamFrame } from '../../services/diagram-stream-v2.service';
import { DiagramInteractivityService } from '../../services/diagram-interactivity.service';

/**
 * SvgCanvas — render the server-emitted SVG from diagram-service v2.
 *
 * <p>The diagram-service v2 returns a fully self-contained SVG with embedded
 * styles, icons (via {@code <symbol id="…">}) and an
 * {@code onclick="sendPrompt(…)"} on every interactive node. This component
 * just injects the SVG into the DOM via {@code innerHTML}, then:
 *
 * <ul>
 *   <li>Subscribes to the compile (or edit) stream and swaps in the new
 *       SVG when the {@code final} frame arrives.</li>
 *   <li>Optionally renders a small status banner while phases stream in.</li>
 *   <li>Forwards the trace-level events to the parent component via
 *       {@code (phaseChanged)} so the workspace can show a progress strip.</li>
 * </ul>
 */
@Component({
  selector: 'app-svg-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="svg-canvas-wrapper">
      <div #svgHost
           class="svg-host"
           [class.streaming]="phase && phase !== 'final' && phase !== 'complete'">
      </div>

      <div *ngIf="phase && phase !== 'complete' && phase !== 'final'"
           class="svg-status">
        <span class="svg-status-dot"></span>
        <span>{{ humanPhase(phase) }}</span>
      </div>

      <div *ngIf="errorMessage" class="svg-error">
        <strong>Render failed:</strong> {{ errorMessage }}
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; width:100%; height:100%; position:relative; }
    .svg-canvas-wrapper { position:relative; width:100%; height:100%; }
    .svg-host { width:100%; height:100%; overflow:auto; background:#FFFFFF; }
    .svg-host.streaming { opacity:0.85; transition: opacity 0.3s; }
    .svg-host :global(svg) { width:100%; height:auto; display:block; }
    .svg-status {
      position:absolute; top:12px; left:12px;
      background:rgba(15,23,42,0.85); color:#FFFFFF;
      padding:6px 12px; border-radius:6px; font-size:12px;
      display:flex; align-items:center; gap:8px; pointer-events:none;
    }
    .svg-status-dot {
      width:8px; height:8px; border-radius:50%; background:#22C55E;
      animation: pulse 1.2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity:1; transform:scale(1); }
      50% { opacity:0.4; transform:scale(0.7); }
    }
    .svg-error {
      position:absolute; bottom:12px; left:12px; right:12px;
      background:#FEE2E2; color:#991B1B; padding:8px 12px;
      border-radius:6px; font-size:13px;
    }
  `],
})
export class SvgCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Static SVG to render (skip live stream). */
  @Input() svg: string | null = null;
  /** Workspace + diagram id — used by the edit-stream subscription. */
  @Input() workspaceId: string | null = null;
  @Input() diagramId: string | null = null;
  /** Trace id from /v2/compile — used by the compile-stream subscription. */
  @Input() traceId: string | null = null;

  @Output() phaseChanged = new EventEmitter<string>();
  @Output() rendered = new EventEmitter<{ svg: string; drawioXml: string; patternId: string }>();

  @ViewChild('svgHost', { static: true }) host!: ElementRef<HTMLDivElement>;

  phase: string = '';
  errorMessage: string | null = null;
  private sub: Subscription | null = null;

  constructor(
      private readonly stream: DiagramStreamV2Service,
      // ensure the global window.sendPrompt hook is installed
      private readonly _interactivity: DiagramInteractivityService) { }

  ngAfterViewInit(): void {
    this.applyStaticIfPresent();
    this.subscribeStream();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['svg']) this.applyStaticIfPresent();
    if (changes['traceId'] || changes['workspaceId'] || changes['diagramId']) {
      this.subscribeStream();
    }
  }

  ngOnDestroy(): void {
    if (this.sub) { this.sub.unsubscribe(); this.sub = null; }
  }

  /** Format a phase name for the status badge. */
  humanPhase(phase: string): string {
    switch (phase) {
      case 'pattern-matched': return 'Recognising layout pattern…';
      case 'overrides-applied': return 'Applying your overrides…';
      case 'lanes-pinned': return 'Pinning lanes…';
      case 'region-laid-out': return 'Laying out regions…';
      case 'edges-routed': return 'Routing edges…';
      case 'geometry-final': return 'Finalising geometry…';
      case 'final': return 'Rendering…';
      default: return phase || '';
    }
  }

  private applyStaticIfPresent(): void {
    if (this.svg && this.host) {
      this.host.nativeElement.innerHTML = this.svg;
    }
  }

  private subscribeStream(): void {
    if (this.sub) { this.sub.unsubscribe(); this.sub = null; }
    this.errorMessage = null;
    this.phase = '';

    let obs;
    if (this.traceId) {
      obs = this.stream.openCompile(this.traceId);
    } else if (this.workspaceId && this.diagramId) {
      obs = this.stream.openEdit(this.workspaceId, this.diagramId);
    } else {
      return;
    }

    this.sub = obs.subscribe((frame: V2StreamFrame) => {
      if (frame.type === 'error') {
        this.errorMessage = frame.message || 'Unknown error';
        this.phase = '';
        this.phaseChanged.emit('error');
        return;
      }
      if (frame.type === 'complete') {
        this.phaseChanged.emit('complete');
        this.phase = 'complete';
        return;
      }
      if (frame.type === 'phase') {
        this.phase = frame.phase || '';
        this.phaseChanged.emit(this.phase);

        if (frame.phase === 'final' && frame.data) {
          const svgString = (frame.data.svg as string) || '';
          if (svgString && this.host) {
            this.host.nativeElement.innerHTML = svgString;
          }
          this.rendered.emit({
            svg: svgString,
            drawioXml: (frame.data.drawioXml as string) || '',
            patternId: (frame.data.patternId as string) || '',
          });
        }
      }
    });
  }
}
