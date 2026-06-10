import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy,
  Output, SimpleChanges, ViewChild, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  Graph,
  InternalEvent,
  Point,
  type CellStyle,
} from '@maxgraph/core';
import { IconService } from '../../services/icon.service';
import { DiagramPaletteService } from '../../services/diagram-palette.service';

/**
 * Bundled generic "user / actor" glyph. v2 tags actor leaves with the
 * provider-neutral iconToken "person" (DefaultStyleResolver.roleToken), which
 * has no vendor icon in the icon-service — so we render this self-contained SVG
 * instead of leaving the node icon-less. Kept inline (data URI) so it always
 * resolves with zero network dependency. A simple head+shoulders silhouette in
 * neutral slate, matching the "user/actor" depiction in cloud reference decks.
 */
const PERSON_ICON_DATA_URI =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
    '<circle cx="24" cy="15" r="9" fill="#5B6B7B"/>' +
    '<path d="M7 43c0-9.2 7.6-16.5 17-16.5S41 33.8 41 43Z" fill="#5B6B7B"/>' +
    '</svg>');

/** iconTokens that should fall back to the bundled person glyph. */
const PERSON_ICON_TOKENS = new Set(['person', 'user', 'users', 'actor']);

/**
 * V2 MaxGraph canvas — purpose-built for diagram-service-v2's LayoutIR.
 *
 * <p>Distinct from {@code MaxGraphCanvasComponent} (which was designed
 * for the v1 flat-spec output and is kept untouched as a fallback). This
 * component:
 *
 * <ul>
 *   <li>Walks v2's nested {@code regions → groups → leaves} tree directly.</li>
 *   <li>Renders leaves as ICON + label-below, NO white wrapper rectangle.</li>
 *   <li>Renders containers as plain rounded rects with a coloured title
 *       band, NO swimlane base style (so no cascading shadow artifact).</li>
 *   <li>Translates IR absolute coords → MaxGraph parent-relative coords
 *       during the recursive walk.</li>
 *   <li>Pre-fetches every icon URL via the icon-service before
 *       rendering, so first paint shows real icons (not blanks).</li>
 *   <li>Colours containers using the same kind→palette as v2's
 *       StyleProfile so this pane reads as the same diagram as the
 *       SVG pane.</li>
 * </ul>
 *
 * <p>Phase 1 (this commit): rendering only. No edit round-trip, no
 * exports. The user has explicitly asked to validate quality first.
 *
 * <p>The component is mounted only in {@code /v2-sandbox}; the existing
 * workspace continues to use the v1 component until this one is
 * accepted.
 */
@Component({
  selector: 'app-v2-maxgraph-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #host class="v2-mxg-host"
         [class.empty]="!ir && !snapshot"
         [class.drag-over]="dragOver"
         (dragover)="onDragOver($event)"
         (dragleave)="onDragLeave($event)"
         (drop)="onDrop($event)"></div>
    <div *ngIf="!ir && !snapshot" class="v2-mxg-placeholder">
      No LayoutIR — compile a diagram first.
    </div>
    <div *ngIf="loading" class="v2-mxg-loading">Loading icons…</div>
    <div *ngIf="dragOver" class="v2-mxg-drophint">Drop to add component</div>
  `,
  styles: [`
    :host { display:block; width:100%; height:100%; position: relative; }
    .v2-mxg-host {
      width: 100%; height: 100%; min-height: 520px;
      /* Transparent so the workspace's dotted-grid canvas (.canvas-bg)
         shows THROUGH the diagram — the diagram floats on the dotted
         drawing surface rather than sitting on an opaque white panel.
         Reference architectures (AWS/Azure) render on a plain/dotted
         canvas, not a hard white card. */
      background: transparent; overflow: auto;
      cursor: grab;
      /* Hide the visible scrollbar but keep wheel / two-finger touchpad
         scrolling and drag-to-pan fully working (Firefox + legacy Edge). */
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    /* Chromium / Safari / Edge — collapse the scrollbar track to zero. */
    .v2-mxg-host::-webkit-scrollbar { width: 0; height: 0; display: none; }
    .v2-mxg-host.empty { background: repeating-conic-gradient(#F8FAFC 0% 25%, transparent 0% 50%) 50% / 16px 16px; }
    .v2-mxg-host.drag-over { outline: 2px dashed #2563EB; outline-offset: -4px; background: rgba(37,99,235,0.04); }
    .v2-mxg-drophint {
      position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
      background: #2563EB; color: #fff; padding: 4px 12px; border-radius: 999px;
      font-size: 11px; font-weight: 600; pointer-events: none; z-index: 5;
    }
    .v2-mxg-placeholder {
      position: absolute; inset: 0; display: flex;
      align-items: center; justify-content: center;
      color: #64748B; font-size: 13px; pointer-events: none;
    }
    .v2-mxg-loading {
      position: absolute; top: 8px; right: 8px;
      background: rgba(15, 23, 42, 0.85); color: #FFFFFF;
      padding: 4px 10px; border-radius: 999px;
      font-size: 11px; pointer-events: none;
    }
  `],
})
export class V2MaxGraphCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {

  /** v2 LayoutIR — the {@code ir} field from a compile-from-prompt response. */
  @Input() ir: LayoutIR | null = null;

  /**
   * Optional flat canvas snapshot (absolute-positioned cells) produced by a
   * prior edit session via {@link getSnapshot}. When present it is rendered
   * VERBATIM instead of the nested {@code ir} — this is how manual edits
   * (moved nodes, inserted shapes/icons, drawn arrows) survive a reload.
   */
  @Input() snapshot: CanvasSnapshot | null = null;

  /** Enables drag-drop insert + move/label/resize/connect. */
  @Input() editable = true;

  /** Fires (true) the first time the user edits the canvas after a render. */
  @Output() dirtyChange = new EventEmitter<boolean>();

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  private readonly iconService = inject(IconService);
  private readonly paletteService = inject(DiagramPaletteService);
  private graph: Graph | null = null;
  private iconUrls = new Map<string, string>();
  loading = false;
  dragOver = false;
  private dirty = false;
  /** Suppresses dirty events while we programmatically build the cell tree. */
  private building = false;

  ngAfterViewInit(): void {
    this.initGraph();
    if (this.ir) void this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['ir'] || changes['snapshot']) && this.graph) {
      this.iconUrls.clear();
      this.setDirty(false);
      void this.render();
    }
  }

  ngOnDestroy(): void {
    if (this.graph) {
      this.graph.destroy();
      this.graph = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Graph init — modest defaults; tweak in Phase 4 polish
  // ─────────────────────────────────────────────────────────────────

  private initGraph(): void {
    const g = new Graph(this.host.nativeElement);

    g.setHtmlLabels(true);
    g.setPanning(true);
    // Interactive editing (drag to move, double-click to rename, resize,
    // draw connections). Gated by `editable` so the read-only contexts
    // (e.g. a preview) can still opt out. Persistence is batched — the user
    // hits "Sync" to save, so none of these fire a BFF call per change.
    g.setCellsMovable(this.editable);
    g.setCellsResizable(this.editable);
    g.setCellsEditable(this.editable);
    g.setConnectable(this.editable);
    g.setAllowDanglingEdges(false);
    g.setMultigraph(true);

    // Mark the canvas dirty on any structural / geometry / label change the
    // USER makes (suppressed while we build the tree programmatically).
    g.getDataModel().addListener(InternalEvent.CHANGE, () => {
      if (!this.building) this.setDirty(true);
    });

    // Default edge style — orthogonal with SHARP 90° corners (square bends),
    // matching cloud reference architecture connectors (draw.io / Lucidchart /
    // Visio style), not rounded sweeps.
    // MaxGraph 0.23 tightened CellStateStyle typing; cast lets us set
    // string-keyed style fields that maxGraph still honours at runtime
    // (the alternative is converting EVERY field to a typed setter call).
    const es = g.getStylesheet().getDefaultEdgeStyle() as Record<string, unknown>;
    es['edgeStyle'] = 'orthogonalEdgeStyle';
    es['rounded'] = false;
    es['html'] = true;
    es['fontSize'] = 10;
    es['fontColor'] = '#475569';
    es['strokeColor'] = '#475569';
    es['strokeWidth'] = 1.4;
    es['endArrow'] = 'classic';
    es['endFill'] = true;
    es['labelBackgroundColor'] = '#FFFFFF';

    // Mouse-wheel zoom (centred on cursor) so dense diagrams are usable
    InternalEvent.addMouseWheelListener((evt: Event, up: boolean) => {
      const e = evt as WheelEvent;
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      up ? g.zoomIn() : g.zoomOut();
    }, this.host.nativeElement);

    this.graph = g;
  }

  // ─────────────────────────────────────────────────────────────────
  // Render — prefetch icons, then walk IR → cells in one batchUpdate
  // ─────────────────────────────────────────────────────────────────

  private async render(): Promise<void> {
    if (!this.graph) return;
    // A saved edit snapshot wins over the nested IR — it carries the user's
    // manual layout + inserted cells verbatim.
    if (this.snapshot && (this.snapshot.nodes?.length || this.snapshot.edges?.length)) {
      this.building = true;
      try { this.buildFromSnapshot(this.snapshot); } finally { this.building = false; }
      return;
    }
    if (!this.ir) return;
    await this.prefetchIcons();
    this.building = true;
    try { this.buildCellTree(); } finally { this.building = false; }
  }

  private setDirty(value: boolean): void {
    if (this.dirty === value) return;
    this.dirty = value;
    this.dirtyChange.emit(value);
  }

  isDirty(): boolean { return this.dirty; }

  private async prefetchIcons(): Promise<void> {
    if (!this.ir) return;
    const tokens = new Set<string>();
    const provider = this.ir?.provider;
    const collect = (node: AnyIRChild | undefined): void => {
      if (!node || typeof node !== 'object') return;
      if ((node as LayoutIRLeaf)._type === 'leaf') {
        const t = (node as LayoutIRLeaf).iconToken;
        if (t) tokens.add(t);
        return;
      }
      // Containers (regions + groups) also need icons — header-bar
      // service marks (AWS region flag, Azure VNet icon, AKS cluster
      // hex, etc.). Map kind+provider → token via the resolver and
      // include it in the pre-fetch batch so the FIRST render shows
      // every icon already loaded (no flash of un-iconed headers).
      const c = node as LayoutIRRegion | LayoutIRGroup;
      const headerToken = (this.feStyle(c.id)?.headerIcon as string)
          || containerIconTokenFor(provider, c.kind, c.styleToken);
      if (headerToken) tokens.add(headerToken);
      (c.children ?? []).forEach(child => collect(child));
    };
    (this.ir.regions ?? []).forEach(r => collect(r));

    this.loading = true;
    try {
      const entries = await Promise.all(
          [...tokens].map(async token => {
            const iconId = iconTokenToIconId(token);
            if (!iconId) return null;
            try {
              const url = await firstValueFrom(this.iconService.getIconUrl(iconId));
              return [token, sanitiseIconUrl(url)] as const;
            } catch { return null; }
          }));
      for (const e of entries) {
        if (e) this.iconUrls.set(e[0], e[1]);
      }
    } finally {
      this.loading = false;
    }
  }

  private buildCellTree(): void {
    if (!this.graph || !this.ir) return;
    const graph = this.graph;
    const parent = graph.getDefaultParent();
    const cells = new Map<string, any>();

    graph.batchUpdate(() => {
      graph.removeCells(graph.getChildCells(parent), true);

      // CRITICAL: v2's IR uses MIXED coordinate systems —
      //   - Top-level regions: canvas-absolute (e.g. AWS Cloud @24,24)
      //   - Every nested child: PARENT-RELATIVE (e.g. VPC inside Cloud at 16,16,
      //     meaning "16 pixels in from Cloud's top-left")
      //
      // maxGraph's `insertVertex(parent, …, x, y, w, h, …)` interprets x/y
      // as relative to the parent cell. So both systems map 1:1 — we just
      // pass IR coords through unchanged. No absolute-to-relative
      // translation; my earlier subtraction pushed children to negative
      // offsets, which is why multiple leaves piled on the same position.
      const walk = (node: AnyIRChild, parentCell: any): void => {
        if (!node || typeof node !== 'object') return;
        const g: Geometry = node.geometry ?? DEFAULT_GEO;

        if ((node as LayoutIRLeaf)._type === 'leaf') {
          const leaf = node as LayoutIRLeaf;
          const cell = graph.insertVertex(
              parentCell, leaf.id, leaf.label ?? leaf.id,
              g.x, g.y, g.width, g.height,
              this.leafStyle(leaf));
          cells.set(leaf.id, cell);
          return;
        }

        const c = node as LayoutIRRegion | LayoutIRGroup;
        const cell = graph.insertVertex(
            parentCell, c.id, c.label ?? c.kind ?? '',
            g.x, g.y, g.width, g.height,
            this.containerStyle(c));
        cells.set(c.id, cell);
        (c.children ?? []).forEach(grand => walk(grand, cell));
      };

      (this.ir!.regions ?? []).forEach(r => walk(r, parent));

      (this.ir!.edges ?? []).forEach(edge => {
        const src = cells.get(edge.fromEntityId);
        const tgt = cells.get(edge.toEntityId);
        if (!src || !tgt) return;
        const e = graph.insertEdge(
            parent, edge.id, edge.label ?? '', src, tgt,
            this.edgeStyle(edge));
        this.applyWaypoints(e, edge);
      });
    });

    // Smart fit — only zoom DOWN to fit if the content is bigger than
    // the viewport. Never zoom UP past 1.0 (otherwise small diagrams
    // get magnified, blurring icons; and large host areas drag the
    // zoom way down, making everything tiny — the regression from the
    // previous turn's naive fit(20)).
    try {
      const host = this.host.nativeElement;
      const bounds = graph.getGraphBounds();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const margin = 24;
        const scaleX = (host.clientWidth - margin * 2) / bounds.width;
        const scaleY = (host.clientHeight - margin * 2) / bounds.height;
        const scale = Math.min(1.0, scaleX, scaleY);   // never zoom up
        if (scale < 1.0 && scale > 0) {
          (graph.getView() as any).setScale(scale);
        }
        // Centre the content in the host viewport regardless of scale.
        const view = graph.getView() as any;
        if (typeof view.setTranslate === 'function') {
          const tx = (host.clientWidth / scale - bounds.width) / 2 - bounds.x;
          const ty = margin / scale - bounds.y;
          view.setTranslate(tx, ty);
        }
      }
    } catch { /* fit is cosmetic; never fail the render */ }
  }

  // ─────────────────────────────────────────────────────────────────
  // Style builders
  // ─────────────────────────────────────────────────────────────────

  private leafStyle(leaf: LayoutIRLeaf): CellStyle {
    let iconUrl = leaf.iconToken ? this.iconUrls.get(leaf.iconToken) : undefined;
    // Actor/user leaves carry an iconToken whose slug is "person" — bare
    // ("person") or provider-prefixed ("azure/person", "aws/person", …),
    // because TechnologyTokenizer prepends the provider. None of these have a
    // real vendor icon, so fall back to the bundled person glyph (matching the
    // slug, not the full token) instead of leaving the user as a blank pill.
    if (!iconUrl && leaf.iconToken) {
      const slug = (leaf.iconToken.toLowerCase().split('/').pop() ?? '');
      if (PERSON_ICON_TOKENS.has(slug)) iconUrl = PERSON_ICON_DATA_URI;
    }
    if (iconUrl) {
      // Icon centred in upper portion, label below. Hard-coded sizes so
      // a 60-wide leaf and a 200-wide leaf both render cleanly: icon
      // never bigger than 44px, label area never less than 32px.
      const w = leaf.geometry?.width ?? 160;
      const h = leaf.geometry?.height ?? 60;
      const iconSz = Math.min(44, h * 0.55, w * 0.55);
      const labelArea = Math.max(28, h - iconSz - 6);
      return {
        shape: 'label',
        image: iconUrl,
        imageWidth: iconSz,
        imageHeight: iconSz,
        imageAlign: 'center',
        verticalAlign: 'top',
        align: 'center',
        fillColor: 'none',
        strokeColor: 'none',
        strokeWidth: 0,
        fontColor: '#0F172A',
        fontSize: 11,
        fontStyle: 0,
        // Label sits below the icon. spacingTop pushes it down by exactly
        // iconSz + small gap so it never overlaps the icon at small sizes.
        spacingTop: iconSz + 6,
        spacingBottom: 2,
        spacingLeft: 4,
        spacingRight: 4,
        whiteSpace: 'wrap',
        overflow: 'hidden',
        // Truncate-with-ellipsis behaviour for very long technology names.
        // Without this, long labels wrap to 3+ lines and run into the
        // next leaf below.
        labelPadding: 2,
      } as any;
    }
    // Fallback when icon unavailable: subtle role-coloured pill.
    return {
      shape: 'rectangle',
      rounded: true,
      arcSize: 24,
      fillColor: '#F1F5F9',
      strokeColor: '#94A3B8',
      strokeWidth: 1,
      fontColor: '#0F172A',
      fontSize: 11,
      fontStyle: 0,
      align: 'center',
      verticalAlign: 'middle',
      whiteSpace: 'wrap',
      overflow: 'hidden',
    };
  }

  /** v2 resolved-StyleProfile token for an entity id, or undefined.
   *  Single source of truth: same profile the SVG adapter renders. */
  private feStyle(id?: string): any {
    if (!id) return undefined;
    const map = this.ir?.styleHints?.['v2.feStyles'];
    return map ? map[id] : undefined;
  }

  private containerStyle(c: LayoutIRRegion | LayoutIRGroup): CellStyle {
    const kindKey = (c.kind ?? '').toUpperCase();
    // Provider-aware palette loaded from /assets/diagram-palettes/<id>.json
    // by DiagramPaletteService — used ONLY as a fallback when v2 didn't emit
    // a resolved style for this entity. The reference look comes from
    // feStyle() below (v2's StyleProfile), keeping one source of truth.
    const palette = this.paletteService.paletteFor(this.ir?.provider);
    const sharp = palette.cornerStyle === 'sharp';
    const tok = palette.containers[kindKey] ?? palette.containers['DEFAULT'];
    const fe = this.feStyle(c.id);
    // Header-bar service icon (top-left corner) — AWS region flag, Azure
    // VNet hex, AKS cluster icon, etc. The URL was prefetched in
    // prefetchIcons. When absent we render the header text-only.
    const styleToken = (c as LayoutIRGroup).styleToken;
    const headerIconToken = (fe?.headerIcon as string)
        || containerIconTokenFor(this.ir?.provider, c.kind, styleToken);
    const headerIconUrl = headerIconToken ? this.iconUrls.get(headerIconToken) : undefined;
    // Top-level container kinds (CLOUD/REGION/VPC/SECURITY/OBSERVABILITY/
    // CICD/USERS/EXTERNAL_SYSTEMS) have plenty of horizontal room — use a
    // slightly bigger label so the diagram structure reads at a glance.
    // Inner kinds (AZ/SUBNET/group) stay at 10pt to fit narrow widths.
    const isTopLevelKind = TOP_LEVEL_KINDS.has(kindKey);
    const labelFontSize = isTopLevelKind ? 12 : 10;
    const headerIconSize = isTopLevelKind ? 20 : 16;
    // When an icon is present, the label needs extra left-spacing so it
    // doesn't overlap. The icon sits at imageWidth + 4px breathing room
    // from the container's left edge.
    const labelLeftPad = headerIconUrl
        ? (headerIconSize + 12)   // icon + gap + label
        : 8;                       // plain text padding
    //
    // NOT swimlane — swimlane is what makes child coordinates relative
    // to the WHOLE container including its title bar, which means
    // children at IR y=20 (the v2 pattern's body padding) overlap each
    // other and the title bar. Plain rectangle treats child y as a
    // straight offset from the container's top-left, which matches
    // what v2's ELK layer produced.
    //
    // Visually, AWS / Azure reference diagrams use exactly this idiom:
    // small bold label in the top-left of the container, no header
    // band. Far less visual noise than a swimlane title bar.
    const style: any = {
      shape: 'rectangle',
      // Corner style comes from the palette's `cornerStyle` ("sharp" for
      // Microsoft Azure; "rounded" for AWS / GCP / generic). Source is
      // assets/diagram-palettes/<id>.json so adding a new fidelity tier
      // is a JSON-only change.
      rounded: !sharp,
      arcSize: sharp ? 0 : 8,
      fillColor: tok.fillColor,
      strokeColor: tok.strokeColor,
      strokeWidth: tok.strokeWidth,
      dashed: tok.dashed,
      fontColor: tok.fontColor,
      fontSize: labelFontSize,
      fontStyle: 1,
      align: 'left',
      verticalAlign: 'top',
      spacingLeft: labelLeftPad,
      spacingRight: 4,
      spacingTop: 4,
      shadow: 0,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      collapsible: false,
    };
    // Reference styling: override the FE-palette fallback with v2's resolved
    // StyleProfile (same source the SVG adapter uses) when present.
    if (fe) {
      if (fe.fill) style.fillColor = (fe.fill === 'transparent' || fe.fill === 'none') ? 'none' : fe.fill;
      if (fe.stroke) style.strokeColor = fe.stroke;
      if (typeof fe.strokeWidth === 'number' && fe.strokeWidth > 0) style.strokeWidth = fe.strokeWidth;
      if (fe.lineStyle) style.dashed = fe.lineStyle === 'dashed';
      if (fe.dashArray) { style.dashed = true; style.dashPattern = String(fe.dashArray).replace(/,/g, ' '); }
      if (fe.fontColor) style.fontColor = fe.fontColor;
    }
    // Embed the header icon via MaxGraph's image style. imageAlign/
    // imageVerticalAlign pin it to the top-left of the container so it
    // sits next to the label rather than centred.
    if (headerIconUrl) {
      style.image = headerIconUrl;
      style.imageAlign = 'left';
      style.imageVerticalAlign = 'top';
      style.imageWidth = headerIconSize;
      style.imageHeight = headerIconSize;
    }
    return style as CellStyle;
  }

  private edgeStyle(edge: LayoutIREdge): CellStyle {
    const tok = EDGE_TOKENS[(edge.kind ?? '').toUpperCase()] ?? EDGE_TOKENS['DEFAULT'];
    const fe = this.feStyle(edge.id);
    // When v2 ships an explicit orthogonal route (waypoints), we render the
    // edge as straight segments THROUGH those bends (they're already
    // axis-aligned). MaxGraph's built-in orthogonalEdgeStyle auto-router would
    // discard/override the supplied control points and naively re-route
    // straight through nodes — so only enable it as the fallback for edges
    // that arrive WITHOUT a server route.
    const hasRoute = !!(edge.waypoints && edge.waypoints.length >= 3);
    const style: any = {
      ...(hasRoute ? {} : { edgeStyle: 'orthogonalEdgeStyle' }),
      rounded: false,   // sharp 90° corners (reference-grade connectors)
      strokeColor: tok.strokeColor,
      strokeWidth: tok.strokeWidth,
      dashed: tok.dashed,
      dashPattern: tok.dashPattern,
      endArrow: tok.endArrow,
      endFill: tok.endFill,
      startArrow: tok.startArrow,
      startFill: tok.startFill,
      // Edge labels — smaller font + opaque white pill so they don't
      // collide visually with the nodes they cross. labelBorderColor
      // gives the pill a thin matching outline (legibility win).
      fontSize: 9,
      fontStyle: 0,
      fontColor: tok.strokeColor,
      labelBackgroundColor: '#FFFFFF',
      labelBorderColor: tok.strokeColor,
      labelPadding: 3,
      html: true,
      // Pin label to ~30% along the edge so consecutive edges between
      // the same node pair don't stack labels on top of each other.
      labelPosition: 'center',
      verticalLabelPosition: 'middle',
      align: 'center',
      verticalAlign: 'middle',
    };
    // Reference styling: v2's resolved edge profile (colour/width/dash) wins
    // over the FE edge-token fallback when present.
    if (fe) {
      if (fe.stroke) { style.strokeColor = fe.stroke; style.fontColor = fe.stroke; style.labelBorderColor = fe.stroke; }
      if (typeof fe.strokeWidth === 'number' && fe.strokeWidth > 0) style.strokeWidth = fe.strokeWidth;
      if (fe.lineStyle) style.dashed = fe.lineStyle === 'dashed';
      if (fe.dashArray) { style.dashed = true; style.dashPattern = String(fe.dashArray).replace(/,/g, ' '); }
    }
    return style as CellStyle;
  }

  /**
   * Feed v2's server-computed orthogonal route into the MaxGraph edge as
   * explicit control points, so the canvas renders the exact lane-routed path
   * the geometry layer engineered (around nodes, through lane gaps, with
   * parallel-edge band offsets) instead of MaxGraph's naive auto-route.
   *
   * <p>Waypoints are ABSOLUTE canvas coords. Edges are parented to the graph
   * root, whose coordinate space is absolute, so they map 1:1 (no parent
   * translation). We pass the INTERIOR bends only (slice 1..n-1): the first &
   * last points are perimeter anchors that coincide with where MaxGraph clips
   * the edge at the src/tgt cell boundary, so dropping them keeps the route
   * identical while letting the endpoints track the cells. Because each bend
   * shares the perpendicular coordinate of its adjacent anchor, the resulting
   * polyline is fully orthogonal end-to-end.
   */
  private applyWaypoints(cell: any, edge: LayoutIREdge): void {
    const wps = edge.waypoints;
    if (!cell || !wps || wps.length < 3) return;   // need ≥1 interior bend
    const geo = typeof cell.getGeometry === 'function' ? cell.getGeometry() : cell.geometry;
    if (!geo) return;
    geo.points = wps.slice(1, -1).map(p => new Point(p.x, p.y));
  }

  // ───────────────────────────────────────────────────────────────────
  // Interactive editing: drag-drop insert + snapshot serialize/restore
  // ───────────────────────────────────────────────────────────────────

  onDragOver(evt: DragEvent): void {
    if (!this.editable) return;
    evt.preventDefault();
    if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'copy';
    this.dragOver = true;
  }

  onDragLeave(_evt: DragEvent): void { this.dragOver = false; }

  onDrop(evt: DragEvent): void {
    this.dragOver = false;
    if (!this.editable || !this.graph) return;
    evt.preventDefault();
    const raw = evt.dataTransfer?.getData('application/json');
    if (!raw) return;
    let item: PaletteItem;
    try { item = JSON.parse(raw); } catch { return; }
    const pt = this.clientToGraph(evt.clientX, evt.clientY);
    void this.insertComponentAt(item, pt.x, pt.y);
  }

  /** Click-to-add entry point (palette → workspace → here). Inserts near the
   *  visible centre of the canvas. */
  insertComponent(item: PaletteItem): void {
    if (!this.graph) return;
    const host = this.host.nativeElement;
    const r = host.getBoundingClientRect();
    const pt = this.clientToGraph(r.left + host.clientWidth / 2, r.top + host.clientHeight / 3);
    void this.insertComponentAt(item, pt.x, pt.y);
  }

  private clientToGraph(clientX: number, clientY: number): { x: number; y: number } {
    const g: any = this.graph!;
    const view: any = g.getView();
    const scale = (typeof view.getScale === 'function' ? view.getScale() : view.scale) || 1;
    const tr = (typeof view.getTranslate === 'function' ? view.getTranslate() : view.translate) || { x: 0, y: 0 };
    const host = this.host.nativeElement;
    const rect = host.getBoundingClientRect();
    const px = clientX - rect.left + host.scrollLeft;
    const py = clientY - rect.top + host.scrollTop;
    return { x: Math.round(px / scale - tr.x), y: Math.round(py / scale - tr.y) };
  }

  private async insertComponentAt(item: PaletteItem, x: number, y: number): Promise<void> {
    const g = this.graph!;
    const parent = g.getDefaultParent();
    const id = `ins-${(item.id || 'cell')}-${Date.now().toString(36)}`;
    const shape = item.shapeType || '';

    // Arrows / lines → a floating edge with explicit end points.
    if (shape.startsWith('arrow-') || shape === 'line' || shape === 'dashed-line') {
      g.batchUpdate(() => {
        const e: any = g.insertEdge(parent, id, '', null as any, null as any,
            this.insertEdgeStyle(shape));
        const geo: any = e.getGeometry ? e.getGeometry() : e.geometry;
        if (geo) {
          geo.setTerminalPoint(new Point(x, y + 30), true);
          geo.setTerminalPoint(new Point(x + 130, y + 30), false);
          geo.relative = true;
        }
      });
      this.setDirty(true);
      return;
    }

    // Resolve an icon for cloud / general items (palette ids match icon-service ids).
    let iconUrl = '';
    if (item.iconUrl) {
      iconUrl = sanitiseIconUrl(item.iconUrl);
    } else if (!shape && item.id) {
      try { iconUrl = sanitiseIconUrl(await firstValueFrom(this.iconService.getIconUrl(item.id))); }
      catch { iconUrl = ''; }
    }

    g.batchUpdate(() => {
      const [w, h] = this.insertSize(item, !!iconUrl);
      g.insertVertex(parent, id, item.name ?? '', x, y, w, h, this.insertStyle(item, iconUrl));
    });
    this.setDirty(true);
  }

  private insertSize(item: PaletteItem, hasIcon: boolean): [number, number] {
    const s = item.shapeType || '';
    if (hasIcon) return [120, 78];
    if (s === 'text') return [120, 32];
    if (s === 'circle') return [90, 90];
    if (s === 'diamond') return [110, 90];
    if (s === 'note') return [150, 90];
    if (s === 'group') return [240, 160];
    if (!s) return [140, 56];            // general icon fallback (labeled pill)
    return [130, 72];                     // generic shapes
  }

  private insertStyle(item: PaletteItem, iconUrl: string): CellStyle {
    const s = item.shapeType || '';
    if (iconUrl) {
      return {
        shape: 'label', image: iconUrl, imageWidth: 44, imageHeight: 44,
        imageAlign: 'center', verticalAlign: 'top', align: 'center',
        fillColor: 'none', strokeColor: 'none', fontColor: '#0F172A',
        fontSize: 11, spacingTop: 50, whiteSpace: 'wrap', overflow: 'hidden',
      } as any;
    }
    const base: any = {
      fontColor: '#0F172A', fontSize: 12, align: 'center', verticalAlign: 'middle',
      whiteSpace: 'wrap', strokeColor: '#475569', strokeWidth: 1.4, fillColor: '#FFFFFF',
    };
    switch (s) {
      case 'text':
        return { ...base, fillColor: 'none', strokeColor: 'none', fontStyle: 0 };
      case 'rounded-rectangle':
        return { ...base, shape: 'rectangle', rounded: true, arcSize: 12 };
      case 'circle':
        return { ...base, shape: 'ellipse' };
      case 'diamond':
        return { ...base, shape: 'rhombus' };
      case 'hexagon':
        return { ...base, shape: 'hexagon' };
      case 'cylinder':
        return { ...base, shape: 'cylinder', verticalAlign: 'bottom' };
      case 'parallelogram':
        return { ...base, shape: 'parallelogram' };
      case 'note':
        return { ...base, shape: 'rectangle', fillColor: '#FEF9C3', strokeColor: '#CA8A04', rounded: true, arcSize: 6 };
      case 'group':
        return { ...base, shape: 'rectangle', fillColor: 'none', dashed: true, rounded: true, arcSize: 8, verticalAlign: 'top', strokeColor: '#94A3B8' };
      case 'rectangle':
        return { ...base, shape: 'rectangle' };
      default:
        // General icon with no resolvable image → labeled rounded pill.
        return { ...base, shape: 'rectangle', rounded: true, arcSize: 18, fillColor: '#F1F5F9' };
    }
  }

  private insertEdgeStyle(shape: string): CellStyle {
    const dashed = shape === 'dashed-line';
    const noArrow = shape === 'line' || shape === 'dashed-line';
    const both = shape === 'arrow-bidir';
    return {
      edgeStyle: 'orthogonalEdgeStyle', rounded: true,
      strokeColor: '#1F2937', strokeWidth: 1.6,
      dashed: dashed ? 1 : 0, dashPattern: dashed ? '6 3' : undefined,
      endArrow: noArrow ? 'none' : 'classic', endFill: !noArrow,
      startArrow: both ? 'classic' : 'none', startFill: both,
      html: true,
    } as any;
  }

  // ── Snapshot serialize / restore ─────────────────────────────────────

  /** Serialize the current canvas to a flat, JSON-safe snapshot (absolute
   *  coords) for the Sync save. Re-rendered verbatim via {@link snapshot}. */
  getSnapshot(): CanvasSnapshot {
    const g: any = this.graph;
    if (!g) return { nodes: [], edges: [] };
    const model: any = g.getDataModel();
    const root = g.getDefaultParent();
    const nodes: SnapNode[] = [];
    const edges: SnapEdge[] = [];
    const walk = (cell: any, ox: number, oy: number): void => {
      const count = model.getChildCount(cell);
      for (let i = 0; i < count; i++) {
        const c = model.getChildAt(cell, i);
        const geo = c.getGeometry ? c.getGeometry() : c.geometry;
        const isEdge = c.isEdge ? c.isEdge() : !!c.edge;
        if (isEdge) {
          const s = c.getTerminal ? c.getTerminal(true) : c.source;
          const t = c.getTerminal ? c.getTerminal(false) : c.target;
          edges.push({
            id: c.getId ? c.getId() : c.id,
            source: s ? (s.getId ? s.getId() : s.id) : null,
            target: t ? (t.getId ? t.getId() : t.id) : null,
            label: String(c.getValue ? (c.getValue() ?? '') : (c.value ?? '')),
            style: c.getStyle ? c.getStyle() : c.style,
            sp: geo?.sourcePoint ? { x: geo.sourcePoint.x + ox, y: geo.sourcePoint.y + oy } : null,
            tp: geo?.targetPoint ? { x: geo.targetPoint.x + ox, y: geo.targetPoint.y + oy } : null,
          });
        } else {
          const ax = ox + (geo?.x ?? 0);
          const ay = oy + (geo?.y ?? 0);
          nodes.push({
            id: c.getId ? c.getId() : c.id,
            label: String(c.getValue ? (c.getValue() ?? '') : (c.value ?? '')),
            x: ax, y: ay, w: geo?.width ?? 120, h: geo?.height ?? 60,
            style: c.getStyle ? c.getStyle() : c.style,
          });
          walk(c, ax, ay);   // flatten nested children to absolute coords
        }
      }
    };
    walk(root, 0, 0);
    return { nodes, edges, provider: this.ir?.provider };
  }

  private buildFromSnapshot(snap: CanvasSnapshot): void {
    const g: any = this.graph;
    const parent = g.getDefaultParent();
    const cells = new Map<string, any>();
    g.batchUpdate(() => {
      g.removeCells(g.getChildCells(parent), true);
      for (const nd of snap.nodes ?? []) {
        const c = g.insertVertex(parent, nd.id, nd.label ?? '', nd.x, nd.y, nd.w, nd.h, nd.style as any);
        cells.set(nd.id, c);
      }
      for (const ed of snap.edges ?? []) {
        const s = ed.source ? cells.get(ed.source) : null;
        const t = ed.target ? cells.get(ed.target) : null;
        const e: any = g.insertEdge(parent, ed.id, ed.label ?? '', s ?? null, t ?? null, ed.style as any);
        if ((!s || !t)) {
          const geo: any = e.getGeometry ? e.getGeometry() : e.geometry;
          if (geo) {
            if (ed.sp) geo.setTerminalPoint(new Point(ed.sp.x, ed.sp.y), true);
            if (ed.tp) geo.setTerminalPoint(new Point(ed.tp.x, ed.tp.y), false);
            geo.relative = true;
          }
        }
      }
    });
    this.fitToHost();
  }

  /** Smart fit — never magnify past 1.0; centre content. Shared by both
   *  render paths. */
  private fitToHost(): void {
    if (!this.graph) return;
    try {
      const host = this.host.nativeElement;
      const bounds = this.graph.getGraphBounds();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const margin = 24;
        const scale = Math.min(1.0,
            (host.clientWidth - margin * 2) / bounds.width,
            (host.clientHeight - margin * 2) / bounds.height);
        const view: any = this.graph.getView();
        if (scale < 1.0 && scale > 0 && typeof view.setScale === 'function') view.setScale(scale);
        if (typeof view.setTranslate === 'function') {
          const sc = scale < 1.0 && scale > 0 ? scale : 1;
          view.setTranslate((host.clientWidth / sc - bounds.width) / 2 - bounds.x, margin / sc - bounds.y);
        }
      }
    } catch { /* fit is cosmetic */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Insert palette + edit-snapshot types
// ─────────────────────────────────────────────────────────────────────────

/** A draggable item from the component panel (mirrors IconItem there). */
interface PaletteItem {
  id: string;
  name?: string;
  category?: string;
  iconUrl?: string;
  shapeType?: string;
  lucideIcon?: string;
}

interface SnapNode { id: string; label: string; x: number; y: number; w: number; h: number; style: any; }
interface SnapEdge {
  id: string; source: string | null; target: string | null; label: string; style: any;
  sp?: { x: number; y: number } | null; tp?: { x: number; y: number } | null;
}
/** Flat, JSON-safe edit snapshot persisted via the Sync button and replayed
 *  on reload (the {@code snapshot} @Input). */
export interface CanvasSnapshot { nodes: SnapNode[]; edges: SnapEdge[]; provider?: string; }

// ─────────────────────────────────────────────────────────────────────────
// Style tokens
// ─────────────────────────────────────────────────────────────────────────
//
// Provider palettes live in /assets/diagram-palettes/{aws,azure,gcp,
// generic}.json and are loaded at app init by DiagramPaletteService.
// Adding a new provider style is a JSON file drop + an entry in
// _index.json — no code change. The component injects the service and
// resolves the palette via `paletteService.paletteFor(ir.provider)` on
// every render. The `ContainerToken` / `ProviderPalette` types are
// defined alongside the service in diagram-palette.service.ts.

/**
 * Container kinds that sit at the top of the visual hierarchy (region /
 * lane / band) and have horizontal room for a 12pt label. Inner kinds
 * (AZ, SUBNET, generic groups) stay at 10pt to fit narrower widths.
 */
const TOP_LEVEL_KINDS = new Set<string>([
  'CLOUD', 'REGION', 'VPC', 'VNET', 'RESOURCE_GROUP',
  'SECURITY', 'CICD', 'OBSERVABILITY', 'USERS', 'EXTERNAL_SYSTEMS',
  'SYSTEM_BOUNDARY', 'TRUST_BOUNDARY', 'NETWORK_SEGMENT',
]);

interface EdgeToken {
  strokeColor: string;
  strokeWidth: number;
  dashed?: number;
  dashPattern?: string;
  endArrow: string;
  endFill: boolean;
  startArrow?: string;
  startFill?: boolean;
}

const EDGE_TOKENS: Record<string, EdgeToken> = {
  REQUEST:     { strokeColor: '#1F2937', strokeWidth: 1.4, endArrow: 'classic',     endFill: true },
  RESPONSE:    { strokeColor: '#475569', strokeWidth: 1.2, dashed: 1, dashPattern: '4 2', endArrow: 'open', endFill: false },
  EVENT:       { strokeColor: '#7C3AED', strokeWidth: 1.4, dashed: 1, dashPattern: '2 2', endArrow: 'diamond', endFill: false },
  REPLICATION: { strokeColor: '#0EA5E9', strokeWidth: 1.6, endArrow: 'diamond', endFill: true },
  BRIDGE:      { strokeColor: '#F59E0B', strokeWidth: 1.6, dashed: 1, dashPattern: '6 3', endArrow: 'classic', endFill: true },
  CONTROL:     { strokeColor: '#6B7280', strokeWidth: 1.2, dashed: 1, dashPattern: '1 2', endArrow: 'open', endFill: false },
  BIDI:        { strokeColor: '#1F2937', strokeWidth: 1.4, endArrow: 'classic', endFill: true, startArrow: 'classic', startFill: true },
  DEFAULT:     { strokeColor: '#475569', strokeWidth: 1.4, endArrow: 'classic', endFill: true },
};

// ─────────────────────────────────────────────────────────────────────────
// IR types (loose — same shape v2 emits)
// ─────────────────────────────────────────────────────────────────────────

interface Geometry { x: number; y: number; width: number; height: number; }
interface XY { x: number; y: number; }
const DEFAULT_GEO: Geometry = { x: 0, y: 0, width: 160, height: 60 };

interface LayoutIRLeaf {
  _type: 'leaf';
  id: string;
  label?: string;
  role?: string;
  iconToken?: string;
  geometry?: Geometry;
}
interface LayoutIRGroup {
  _type: 'group';
  id: string;
  label?: string;
  kind?: string;
  /**
   * Free-form style hint emitted by v2 patterns alongside kind — e.g.
   * "availability-zone", "subnet", "cluster", "vnet". Used by the
   * container-icon resolver to distinguish, say, a CLUSTER-kind group
   * that wraps EKS workloads vs one that wraps AKS.
   */
  styleToken?: string;
  geometry?: Geometry;
  children?: AnyIRChild[];
}
interface LayoutIRRegion {
  _type?: 'region';
  id: string;
  label?: string;
  kind?: string;
  /** Optional style hint — mirrors LayoutIRGroup.styleToken. Regions
   *  rarely carry one, but the field keeps the union symmetric so
   *  containerIconTokenFor can be called without narrowing. */
  styleToken?: string;
  lane?: string;
  geometry?: Geometry;
  children?: AnyIRChild[];
}
type AnyIRChild = LayoutIRRegion | LayoutIRGroup | LayoutIRLeaf;

interface LayoutIREdge {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  label?: string;
  kind?: string;
  /**
   * Server-computed orthogonal (Manhattan) route in ABSOLUTE canvas coords,
   * produced by v2's geometry layer (OrthogonalCrossLaneRouter). The first &
   * last points are the exit/entry anchors on the node boundaries; the
   * interior points are the 90° bends that route the edge through the lane
   * gaps (and around sibling nodes). Consumed in applyWaypoints().
   */
  waypoints?: Array<{ x: number; y: number }>;
}
interface LayoutIR {
  diagramId?: string;
  // Optional provider hint — drives the visual palette (Microsoft blue
  // + sharp corners for Azure, AWS multi-coloured + rounded for AWS,
  // neutral for everything else). Set by v2 from IntentGraph.provider.
  provider?: string;
  canvas?: { width?: number; height?: number };
  regions?: LayoutIRRegion[];
  edges?: LayoutIREdge[];
  /**
   * v2-emitted style hints. `styleHints['v2.feStyles']` is the flat
   * per-entity resolved-StyleProfile map { entityId: { fill, stroke,
   * strokeWidth, lineStyle, dashArray, headerIcon, fontColor, … } } that
   * makes the editable canvas paint with the SAME reference profile as the
   * SVG adapter (single source of truth — no separate FE palette).
   */
  styleHints?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────
// Icon token translation — v2 emits "aws/eks" etc.; icon-service wants "aws-eks"
// ─────────────────────────────────────────────────────────────────────────

/**
 * Some icon-service entries (especially AWS Security/Identity & Compliance)
 * embed a literal ``&`` inside the path component of the URL. Browsers
 * interpret ``&`` as a query-parameter separator, so the URL splits at
 * the first ``&`` and the image fetch 404s.
 *
 * Patch the URL here by percent-encoding any ``&`` that appears BEFORE
 * the query string (or anywhere if no ``?`` is present). Leaves an
 * already-correct URL untouched.
 */
function sanitiseIconUrl(url: string | undefined): string {
  if (!url) return '';
  const qIndex = url.indexOf('?');
  const pathPart = qIndex < 0 ? url : url.slice(0, qIndex);
  const queryPart = qIndex < 0 ? '' : url.slice(qIndex);
  const fixed = pathPart.replace(/&/g, '%26');
  return fixed + queryPart;
}

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
 * Map a container kind + provider to the icon token that should sit in
 * the container's header bar (top-left). Returns undefined when no
 * canonical vendor icon applies (AZ / SUBNET / LAYER / generic
 * boundaries don't carry icons in AWS / Azure / GCP reference imagery).
 *
 * The cluster case is provider-aware: when the styleToken says
 * "cluster" the AWS pattern is showing an EKS cluster, Azure an AKS
 * cluster, GCP a GKE cluster. The icon-service resolves these via the
 * same {provider}-{slug} convention as leaf icons.
 */
function containerIconTokenFor(
    provider: string | undefined | null,
    kind: string | undefined,
    styleToken?: string | undefined): string | undefined {
  const p = (provider ?? '').toUpperCase();
  const k = (kind ?? '').toUpperCase();
  const st = (styleToken ?? '').toLowerCase();
  // Provider-aware mapping table. Only entries here resolve to real
  // icon-service IDs — verified against /api/icons. Kinds without a
  // canonical vendor icon (CLOUD, REGION, VNET, RESOURCE_GROUP, USERS,
  // EXTERNAL_SYSTEMS, AZ, SUBNET, LAYER) keep text-only headers, which
  // matches the AWS / Azure reference imagery anyway.
  if (k === 'VPC') return p === 'GCP' ? 'gcp/vpc' : 'aws/vpc';
  if (k === 'CLUSTER' || st === 'cluster') {
    if (p === 'AWS')   return 'aws/eks';
    if (p === 'AZURE') return 'azure/aks';
    if (p === 'GCP')   return 'gcp/gke';
    return undefined;
  }
  if (k === 'SECURITY') {
    if (p === 'AWS')   return 'aws/iam';
    if (p === 'AZURE') return 'azure/key-vault';
    if (p === 'GCP')   return 'gcp/iam';
    return undefined;
  }
  if (k === 'CICD') {
    if (p === 'AWS')   return 'aws/codepipeline';
    if (p === 'AZURE') return 'azure/devops';
    return undefined;
  }
  if (k === 'OBSERVABILITY' || k === 'GENERIC' && st === 'observability-rail') {
    if (p === 'AWS')   return 'aws/cloudwatch';
    if (p === 'AZURE') return 'azure/monitor';
    return undefined;
  }
  return undefined;
}
