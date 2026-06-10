import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SvgCanvasComponent } from '../../components/svg-canvas/svg-canvas.component';
import { MaxGraphCanvasComponent } from '../../components/maxgraph-canvas/maxgraph-canvas.component';
import { V2MaxGraphCanvasComponent } from '../../components/v2-maxgraph-canvas/v2-maxgraph-canvas.component';

/**
 * V2 Sandbox — a self-contained tester for `POST /arch/api/v2/diagram/compile-from-prompt`.
 *
 * This page exists so the new agent-driven IntentGraph path
 * (LLD §11.4 + agent-review §3.1) can be exercised from a browser without
 * touching the existing intake → composition flow. It is intentionally a
 * separate route (`/v2-sandbox`) so it cannot regress any current UX.
 *
 * The page:
 *   1. Collects: viewType, provider, user intent, optional clarifications.
 *   2. Posts to the BFF compose-from-prompt endpoint.
 *   3. Renders the returned SVG via {@link SvgCanvasComponent} (static input
 *      — the trace stream is optional and not wired here to keep the page
 *      runnable even when WebSockets aren't set up locally).
 *   4. Shows validation findings, quality score, IntentGraph + raw response
 *      in collapsible debug panels.
 *
 * Nothing else in the app reads from or routes to this page.
 */
@Component({
  selector: 'app-v2-sandbox',
  standalone: true,
  imports: [CommonModule, FormsModule, SvgCanvasComponent, MaxGraphCanvasComponent, V2MaxGraphCanvasComponent],
  templateUrl: './v2-sandbox.component.html',
  styleUrl: './v2-sandbox.component.scss',
})
export class V2SandboxComponent {
  private readonly http = inject(HttpClient);

  // BFF endpoint goes through the nginx `/arch/` proxy.
  private readonly endpoint = '/arch/api/v2/diagram/compile-from-prompt';

  // ── Form state ──────────────────────────────────────────────────────────
  viewType = signal<string>('c4-context');
  provider = signal<string>('GENERIC');
  // v2's render + persistence layer is typed UUID; the LLM-facing
  // IntentGraph contract accepts strings, but the render passthrough
  // would reject "ws-sandbox" with a 400. Default to real UUIDs so the
  // sandbox stays end-to-end working out of the box.
  workspaceId = signal<string>(uuid());
  diagramId = signal<string>(uuid());
  multicloud = signal<boolean>(false);
  maxRetries = signal<number>(1);
  userIntent = signal<string>(
      'Design a C4 system context diagram for an online retail platform. ' +
      'Actors: customer and admin. ' +
      'External systems: Stripe payment gateway and SendGrid email service.');
  clarificationsText = signal<string>('');

  // ── Result state ────────────────────────────────────────────────────────
  loading = signal<boolean>(false);
  httpStatus = signal<number | null>(null);
  elapsedMs = signal<number | null>(null);
  errorBody = signal<unknown | null>(null);
  result = signal<CompileFromPromptResponse | null>(null);
  showRawJson = signal<boolean>(false);
  // SVG fetched separately from /arch/api/architecture/diagrams/{id}/svg
  // after a successful compile — v2's /compile JSON response doesn't carry
  // the rendered SVG inline (it streams via WebSocket or is fetched via
  // the render endpoint). We use the simpler render-endpoint fetch here.
  fetchedSvg = signal<string | null>(null);
  svgError = signal<string | null>(null);
  // 'split' shows SVG + MaxGraph side-by-side; 'svg' / 'mxgraph' are
  // single-pane modes for focused inspection.
  // 'v2-mxgraph' is the NEW purpose-built renderer (Phase 1: render only).
  // 'mxgraph' (legacy) stays for A/B comparison until V2 is accepted.
  viewMode = signal<'split' | 'svg' | 'v2-mxgraph' | 'mxgraph'>('split');

  // ── Derived signals ─────────────────────────────────────────────────────
  svg = computed<string | null>(() => this.fetchedSvg());

  // v2 stamps the X-Trace-Id header on /v2/compile responses; the BFF v2
  // client lifts it into the body so the sandbox can subscribe to the
  // matching WebSocket stream — which is where the final SVG arrives.
  traceId = computed<string | null>(() => {
    const r = this.result();
    if (!r) return null;
    const t = (r as Record<string, unknown>)['traceId'];
    return typeof t === 'string' && t.length > 0 ? t : null;
  });

  intentGraph = computed<unknown | null>(() => this.result()?.intentGraph ?? null);
  validation = computed<unknown | null>(() => this.result()?.validation ?? null);
  quality = computed<unknown | null>(() => this.result()?.quality ?? null);

  /**
   * Raw v2 LayoutIR enriched with the provider hint from the original
   * IntentGraph. v2's IR itself doesn't carry provider, but
   * V2MaxGraphCanvasComponent uses it to flip palette + corner style
   * (Azure → sharp rectangles + Microsoft blue; default → AWS palette).
   */
  layoutIR = computed<LayoutIR | null>(() => {
    const r = this.result() as Record<string, unknown> | null;
    if (!r) return null;
    const ir = r['ir'] as LayoutIR | undefined;
    if (!ir) return null;
    if (ir.provider) return ir;
    const intentGraph = r['intentGraph'] as Record<string, unknown> | undefined;
    const provider = intentGraph?.['provider'] as string | undefined
        || (intentGraph?.['provider'] as Record<string, unknown> | undefined)?.['name'] as string | undefined;
    return provider ? { ...ir, provider } : ir;
  });

  /** Build the LEGACY MaxGraph-friendly diagramData (kept for the A/B compare pane). */
  maxGraphData = computed<MaxGraphData | null>(() => {
    const ir = this.layoutIR();
    if (!ir) return null;
    return irToMaxGraphData(ir);
  });

  /** Surface agent-side normalisation warnings (e.g. C4 over-decomposition). */
  normalisationWarnings = computed<Array<Record<string, unknown>>>(() => {
    const g = this.intentGraph() as Record<string, unknown> | null;
    if (!g) return [];
    const zones = g['zones'] as Record<string, unknown> | undefined;
    const list = zones?.['_normalisation_warnings'];
    return Array.isArray(list) ? list as Array<Record<string, unknown>> : [];
  });

  errorPretty = computed<string | null>(() => {
    const e = this.errorBody();
    if (!e) return null;
    try { return JSON.stringify(e, null, 2); } catch { return String(e); }
  });

  rawJsonPretty = computed<string | null>(() => {
    const r = this.result();
    if (!r) return null;
    try { return JSON.stringify(r, null, 2); } catch { return null; }
  });

  intentGraphPretty = computed<string | null>(() => {
    const g = this.intentGraph();
    if (!g) return null;
    try { return JSON.stringify(g, null, 2); } catch { return null; }
  });

  async submit(): Promise<void> {
    this.loading.set(true);
    this.httpStatus.set(null);
    this.elapsedMs.set(null);
    this.errorBody.set(null);
    this.result.set(null);
    this.fetchedSvg.set(null);
    this.svgError.set(null);

    const body: Record<string, unknown> = {
      userIntent: this.userIntent().trim(),
      viewType: this.viewType(),
      provider: this.provider(),
      workspaceId: this.workspaceId().trim() || 'ws-sandbox',
      diagramId: this.diagramId().trim() || ('d-' + Math.random().toString(36).slice(2, 8)),
      multicloud: this.multicloud(),
      maxRetries: this.maxRetries(),
    };
    const clars = this.clarificationsText().split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    if (clars.length > 0) body['clarifications'] = clars;

    const startedAt = performance.now();
    try {
      const resp = await firstValueFrom(
          this.http.post<CompileFromPromptResponse>(this.endpoint, body, {
            observe: 'response',
          }));
      this.elapsedMs.set(Math.round(performance.now() - startedAt));
      this.httpStatus.set(resp.status);
      if (resp.body) {
        this.result.set(resp.body);
        // Compile succeeded — v2's HTTP body carries the IR + quality but
        // NOT the rendered SVG (SVG is streamed via WS or fetched on
        // demand). Pull it now so the canvas has something to show.
        const dId = resp.body.diagramId || (body['diagramId'] as string);
        const wsId = (body['workspaceId'] as string) || 'ws-sandbox';
        if (dId) this.fetchSvg(wsId, dId);
      }
    } catch (err: unknown) {
      this.elapsedMs.set(Math.round(performance.now() - startedAt));
      const e = err as { status?: number; error?: unknown; message?: string };
      this.httpStatus.set(typeof e.status === 'number' ? e.status : -1);
      this.errorBody.set(e.error ?? e.message ?? err);
    } finally {
      this.loading.set(false);
    }
  }

  newDiagramId(): void {
    this.diagramId.set(uuid());
  }

  /**
   * Fetch the rendered SVG from the BFF's diagram export passthrough.
   * Tolerates a transient miss (v2 may still be persisting the LayoutIR)
   * by retrying once after a short delay.
   */
  private async fetchSvg(workspaceId: string, diagramId: string, attempt = 1): Promise<void> {
    const url = `/arch/api/architecture/diagrams/${encodeURIComponent(diagramId)}/svg`
        + `?workspaceId=${encodeURIComponent(workspaceId)}`;
    try {
      const svg = await firstValueFrom(
          this.http.get(url, { responseType: 'text' }));
      if (typeof svg === 'string' && svg.trim().startsWith('<svg')) {
        this.fetchedSvg.set(svg);
        return;
      }
      this.svgError.set('SVG endpoint returned non-SVG payload');
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (attempt < 2 && (e.status === 404 || e.status === 500)) {
        // v2 may not have flushed the LayoutIR yet — one retry.
        setTimeout(() => this.fetchSvg(workspaceId, diagramId, attempt + 1), 800);
        return;
      }
      this.svgError.set(`SVG fetch failed: HTTP ${e.status ?? '?'}`);
    }
  }

  statusBadgeClass(): string {
    const s = this.httpStatus();
    if (s === null) return 'badge-idle';
    if (s >= 200 && s < 300) return 'badge-success';
    if (s === 410) return 'badge-gone';
    if (s >= 400 && s < 500) return 'badge-warn';
    return 'badge-error';
  }
}

/** RFC-4122 v4 UUID — uses crypto.randomUUID when available, falls back otherwise. */
function uuid(): string {
  const c = (typeof crypto !== 'undefined' ? crypto : undefined);
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback for sandboxed contexts without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = Math.random() * 16 | 0;
    const v = ch === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Loose shape — the BFF wraps v2's DiagramResponse with extras (intentGraph, source). */
interface CompileFromPromptResponse {
  diagramId?: string;
  version?: number;
  patternId?: string;
  ir?: unknown;
  quality?: unknown;
  validation?: unknown;
  intentGraph?: unknown;
  source?: string;
  traceId?: string;
  [k: string]: unknown;
}

// ────────────────────────────────────────────────────────────────────────
// LayoutIR → MaxGraph adapter (in-file because it's specific to the
// sandbox — production callers would render SVG by default).
// ────────────────────────────────────────────────────────────────────────

interface Geometry { x: number; y: number; width: number; height: number; }
interface LayoutIRLeaf { _type: 'leaf'; id: string; label?: string; role?: string; iconToken?: string; geometry?: Geometry; }
interface LayoutIRGroup { _type: 'group'; id: string; label?: string; kind?: string; geometry?: Geometry; children?: Array<LayoutIRLeaf | LayoutIRGroup>; }
interface LayoutIRRegion { _type?: 'region'; id: string; label?: string; kind?: string; lane?: string; geometry?: Geometry; children?: Array<LayoutIRLeaf | LayoutIRGroup | LayoutIRRegion>; }
interface LayoutIREdge { id: string; fromEntityId: string; toEntityId: string; label?: string; kind?: string; }
interface LayoutIR {
  diagramId?: string;
  // Provider hint copied from the original IntentGraph so v2-maxgraph
  // can flip its palette (Azure → Microsoft blue + sharp corners).
  provider?: string;
  canvas?: { width?: number; height?: number };
  regions?: LayoutIRRegion[];
  edges?: LayoutIREdge[];
}

interface MaxGraphContainer {
  id: string; label: string; geometry: Geometry;
  parentContainerId?: string; kind?: string;
  tier?: string;
  // MaxGraphCanvasComponent.buildContainerStyle reads container.style.*
  style?: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    fontColor?: string;
    headerColor?: string;
    dashed?: number;
  };
}
interface MaxGraphNode {
  id: string; label: string; geometry: Geometry;
  parentContainerId?: string; iconId?: string; role?: string;
  // MaxGraphCanvasComponent.buildNodeStyle reads `style.renderMode === 'icon-label'`
  // to draw the icon WITHOUT the white wrapper rectangle, with the label
  // positioned below at the supplied fontSize/fontStyle.
  style?: {
    renderMode?: 'icon-label';
    fontSize?: number;
    fontStyle?: number;
    fontColor?: string;
  };
}
interface MaxGraphEdge { id: string; from: string; to: string; label?: string; kind?: string; }
interface MaxGraphData {
  containers: MaxGraphContainer[];
  nodes: MaxGraphNode[];
  edges: MaxGraphEdge[];
}

// AWS-reference colour palette per boundary kind. The same palette v2's
// SVG style profile uses, so the MaxGraph pane is at least colour-consistent
// with the SVG even though it can't replicate the full StyleProfile.
/**
 * AWS-reference palette per boundary kind. Mirrors v2's StyleProfile so the
 * MaxGraph pane is at least visually consistent with the SVG pane.
 * {@code dashed=1} maps to maxGraph's dashed-border flag.
 */
const CONTAINER_STYLE_BY_KIND: Record<string, NonNullable<MaxGraphContainer['style']>> = {
  CLOUD:              { strokeColor: '#00A4A6', fillColor: 'none',    dashed: 1, fontColor: '#00A4A6', headerColor: 'transparent' },
  REGION:             { strokeColor: '#00A4A6', fillColor: '#ECF8F9', dashed: 1, fontColor: '#00A4A6', headerColor: '#D6F0F2' },
  VPC:                { strokeColor: '#8C4FFF', fillColor: '#F8F4FF',            fontColor: '#8C4FFF', headerColor: '#EDE0FF', strokeWidth: 2 },
  VNET:               { strokeColor: '#0078D4', fillColor: '#F0F8FF',            fontColor: '#0078D4', headerColor: '#DCEEFF', strokeWidth: 2 },
  AZ:                 { strokeColor: '#3F8DBF', fillColor: '#F1F7FB', dashed: 1, fontColor: '#3F8DBF', headerColor: '#E1EEF6' },
  AVAILABILITY_ZONE:  { strokeColor: '#3F8DBF', fillColor: '#F1F7FB', dashed: 1, fontColor: '#3F8DBF', headerColor: '#E1EEF6' },
  SUBNET:             { strokeColor: '#4B9CD3', fillColor: '#F0F8FF',            fontColor: '#0F4C75', headerColor: '#DCEAF5' },
  RESOURCE_GROUP:     { strokeColor: '#0078D4', fillColor: '#F1F7FB',            fontColor: '#0078D4', headerColor: '#DCEEFF' },
  SYSTEM_BOUNDARY:    { strokeColor: '#475569', fillColor: 'none',    dashed: 1, fontColor: '#475569', headerColor: 'transparent' },
  CONTAINER_BOUNDARY: { strokeColor: '#0F6E56', fillColor: '#E1F5EE',            fontColor: '#0F6E56', headerColor: '#C8EBDD' },
  LAYER:              { strokeColor: '#475569', fillColor: '#F8FAFC',            fontColor: '#475569', headerColor: '#E2E8F0' },
  TRUST_BOUNDARY:     { strokeColor: '#DC2626', fillColor: 'none',    dashed: 1, fontColor: '#DC2626', headerColor: 'transparent' },
  NETWORK_SEGMENT:    { strokeColor: '#475569', fillColor: '#F8FAFC',            fontColor: '#475569', headerColor: '#E2E8F0' },
  USERS:              { strokeColor: '#534AB7', fillColor: '#EEEDFE', dashed: 1, fontColor: '#534AB7', headerColor: '#DEDDF9' },
  EXTERNAL_SYSTEMS:   { strokeColor: '#993C1D', fillColor: '#FAECE7', dashed: 1, fontColor: '#993C1D', headerColor: '#F5D5C9' },
};

/**
 * Translate v2's free-form iconToken ("aws/eks", "icon:compute", "azure/aks")
 * into the icon-service's iconId convention ("aws-eks", "aws-rds", …).
 *
 * Pattern-match heuristic:
 *   - "<provider>/<slug>"      → "<provider>-<slug>"
 *   - "icon:<role>"            → "" (role-only; renderer draws a generic shape)
 *   - "aws-…" / "azure-…" / "gcp-…" → already canonical, passthrough
 *   - anything else            → "" (skip; renderer draws a generic shape)
 */
function iconTokenToIconId(token: string | undefined): string {
  if (!token) return '';
  const t = token.trim().toLowerCase();
  if (!t || t.startsWith('icon:') || t.startsWith('generic/')) return '';
  if (/^(aws|azure|gcp)-/.test(t)) return t;
  const slash = t.indexOf('/');
  if (slash > 0) {
    const provider = t.slice(0, slash);
    const slug = t.slice(slash + 1).replace(/\//g, '-');
    if (provider === 'aws' || provider === 'azure' || provider === 'gcp') {
      return `${provider}-${slug}`;
    }
  }
  return '';
}

/**
 * Flatten the v2 LayoutIR's nested Region/Group/Leaf tree into the flat
 * containers + nodes + edges shape MaxGraphCanvasComponent expects.
 *
 * Geometry comes from the IR (absolute coords). MaxGraph treats each
 * vertex's position as relative to its parent, so we keep the IR's
 * absolute coords as-is and let MaxGraph honour them — works because
 * the IR's geometry IS already child-relative once we set the right
 * parentContainerId.
 */
/**
 * Convert v2's LayoutIR (nested regions/groups/leaves with ABSOLUTE
 * coordinates) into the flat `{containers, nodes, edges}` shape
 * MaxGraphCanvasComponent expects.
 *
 * Two non-obvious things this does:
 *
 * 1. **Absolute → relative coordinates.** The IR's geometry is absolute
 *    canvas coordinates; maxGraph treats vertex geometry as relative to
 *    its parent vertex. Without translation, every child renders at its
 *    absolute IR coordinates *offset by* its parent's origin — nodes
 *    overlap, vanish into other containers, etc.
 *
 * 2. **Icon-only leaf rendering.** MaxGraphCanvasComponent has a
 *    {@code renderMode: 'icon-label'} path that draws the icon WITHOUT
 *    the white rounded wrapper, with the label placed below at a regular
 *    (non-bold) 11px font. Default styling stacks every leaf in a white
 *    rectangle which reads as "container holding empty box holding
 *    label". We opt every leaf into the icon-only mode.
 */
function irToMaxGraphData(ir: LayoutIR): MaxGraphData {
  const containers: MaxGraphContainer[] = [];
  const nodes: MaxGraphNode[] = [];

  const visit = (
      child: LayoutIRRegion | LayoutIRGroup | LayoutIRLeaf,
      parentId: string | undefined,
      parentOrigin: { x: number; y: number },
  ): void => {
    if (!child || typeof child !== 'object') return;
    const absolute = child.geometry ?? { x: 0, y: 0, width: 160, height: 60 };
    // Translate IR-absolute → maxGraph parent-relative.
    const relative: Geometry = {
      x: absolute.x - parentOrigin.x,
      y: absolute.y - parentOrigin.y,
      width: absolute.width,
      height: absolute.height,
    };

    if ((child as LayoutIRLeaf)._type === 'leaf') {
      const leaf = child as LayoutIRLeaf;
      nodes.push({
        id: leaf.id,
        label: leaf.label || leaf.id,
        geometry: relative,
        parentContainerId: parentId,
        iconId: iconTokenToIconId(leaf.iconToken),
        role: leaf.role,
        // Force icon-only rendering — no white wrapper, label below in
        // small non-bold font. fontStyle=0 means regular (1 would be bold).
        style: {
          renderMode: 'icon-label',
          fontSize: 11,
          fontStyle: 0,
          fontColor: '#0F172A',
        },
      });
      return;
    }

    // Region or Group — emit a container, recurse into children using
    // THIS container's absolute origin as the next parent origin so the
    // recursion keeps the absolute→relative conversion correct.
    const c = child as LayoutIRRegion | LayoutIRGroup;
    const kindKey = (c.kind || '').toUpperCase();
    const styleHints = CONTAINER_STYLE_BY_KIND[kindKey] ?? undefined;
    containers.push({
      id: c.id,
      label: c.label || kindKey,
      geometry: relative,
      parentContainerId: parentId,
      kind: c.kind,
      tier: kindKey.toLowerCase(),
      style: styleHints,
    });
    const childOrigin = { x: absolute.x, y: absolute.y };
    (c.children ?? []).forEach(grandchild => visit(grandchild, c.id, childOrigin));
  };

  // Top-level regions have no parent — their "origin" is the canvas (0,0).
  (ir.regions ?? []).forEach(region =>
      visit(region, undefined, { x: 0, y: 0 }));

  const edges: MaxGraphEdge[] = (ir.edges ?? []).map(e => ({
    id: e.id,
    from: e.fromEntityId,
    to: e.toEntityId,
    label: e.label,
    kind: e.kind,
  }));

  return { containers, nodes, edges };
}
