import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, AfterViewInit, ElementRef, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconService } from '../../services/icon.service';
import {
  Graph,
  InternalEvent,
  UndoManager,
  Point,
  ConnectionConstraint,
  Geometry,
  Cell,
  type CellStyle,
} from '@maxgraph/core';

/**
 * MaxGraph Canvas Component — Interactive Diagram Editor (maxGraph)
 *
 * Replaces the deprecated mxGraph CDN with @maxgraph/core ES module.
 * Provides a draw.io-like interactive editor with:
 * - Cell editing (double-click)
 * - Cell resizing with handles
 * - Drawing edges by dragging from connection points
 * - Drag-and-drop component insertion
 * - Delete / Backspace key support
 * - Undo/Redo (Ctrl+Z / Ctrl+Y)
 * - Right-click context menu
 * - Cursor-centered zoom (mouse wheel + trackpad pinch)
 * - HiDPI / Retina support
 */
@Component({
  selector: 'app-maxgraph-canvas',
  standalone: true,
  template: `
    <div class="maxgraph-wrapper">
      <div #graphContainer class="maxgraph-container w-full h-full bg-transparent rounded-lg"
           [class.loading]="isLoading"
           (dragover)="onDragOver($event)"
           (drop)="onDrop($event)">
        <div *ngIf="isLoading" class="loading-overlay">
          <div class="text-center">
            <div class="spinner"></div>
            <p class="mt-4 text-gray-600">Loading diagram...</p>
          </div>
        </div>
        <div *ngIf="error" class="error-overlay">
          <div class="text-center text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <p class="font-semibold text-lg">Diagram Rendering Error</p>
            <p class="text-sm mt-2 text-gray-500 max-w-md">{{error}}</p>
          </div>
        </div>
      </div>
      <!-- Context Menu -->
      <div #contextMenu class="context-menu" *ngIf="contextMenuVisible"
           [style.left.px]="contextMenuX" [style.top.px]="contextMenuY">
        <button class="ctx-item" (click)="ctxEdit()">Edit Label</button>
        <button class="ctx-item" (click)="ctxDuplicate()">Duplicate</button>
        <button class="ctx-item" (click)="ctxToFront()">Bring to Front</button>
        <button class="ctx-item" (click)="ctxToBack()">Send to Back</button>
        <div class="ctx-divider"></div>
        <button class="ctx-item ctx-delete" (click)="ctxDelete()">Delete</button>
      </div>
    </div>
  `,
  styles: [`
    .maxgraph-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
    }
    .maxgraph-container {
      min-height: 500px;
      position: relative;
      overflow: hidden;
      overscroll-behavior: contain;
      touch-action: pan-x pan-y;
      cursor: grab;
    }
    .maxgraph-container:active {
      cursor: grabbing;
    }
    .canvas-toolbar {
      position: absolute;
      top: 10px;
      right: 14px;
      z-index: 20;
      display: flex;
      gap: 4px;
      background: rgba(255,255,255,0.92);
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 3px 4px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.08);
      backdrop-filter: blur(6px);
    }
    .tb-btn {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: background 0.15s;
    }
    .tb-btn:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    .maxgraph-container svg {
      shape-rendering: geometricPrecision;
      text-rendering: optimizeLegibility;
    }
    .loading-overlay, .error-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .spinner {
      border: 4px solid #f3f4f6;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      width: 40px; height: 40px;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .context-menu {
      position: fixed;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      padding: 4px 0;
      z-index: 1000;
      min-width: 170px;
      backdrop-filter: blur(8px);
    }
    .ctx-item {
      display: block;
      width: 100%;
      padding: 8px 16px;
      text-align: left;
      font-size: 13px;
      color: #334155;
      background: none;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .ctx-item:hover {
      background: #f1f5f9;
    }
    .ctx-delete {
      color: #ef4444;
    }
    .ctx-delete:hover {
      background: #fef2f2;
    }
    .ctx-divider {
      height: 1px;
      background: #e2e8f0;
      margin: 4px 0;
    }
  `],
  imports: [CommonModule]
})
export class MaxGraphCanvasComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() diagramData: any = null;
  @Output() diagramChanged = new EventEmitter<any>();
  @ViewChild('graphContainer', { static: false }) graphContainer!: ElementRef;

  private graph: Graph | null = null;
  private undoManager: UndoManager | null = null;
  private initialized = false;
  private isApplyingRender = false;
  isLoading = true;
  error = '';
  private iconUrlCache = new Map<string, string>();
  private readonly zoomFactor = 1.1;
  private readonly minScale = 0.25;
  private readonly maxScale = 4.0;

  // Context menu state
  contextMenuVisible = false;
  contextMenuX = 0;
  contextMenuY = 0;
  private contextMenuCell: Cell | null = null;

  constructor(private iconService: IconService) {}

  @HostListener('document:click')
  onDocumentClick(): void {
    this.contextMenuVisible = false;
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.graph) return;
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      this.undo();
    }
    if (event.ctrlKey && event.key === 'y') {
      event.preventDefault();
      this.redo();
    }
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeGraph();
      if (this.diagramData) {
        this.renderDiagram();
      }
      this.initialized = true;
      this.isLoading = false;
    }, 100);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['diagramData'] && !changes['diagramData'].firstChange && this.initialized) {
      this.renderDiagram();
    }
  }

  ngOnDestroy(): void {
    if (this.graph) {
      this.graph.destroy();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Graph initialization — maxGraph interactive editor
  // ═══════════════════════════════════════════════════════════════

  private initializeGraph(): void {
    if (!this.graphContainer) return;

    try {
      const container = this.graphContainer.nativeElement;

      this.graph = new Graph(container);
      const graph = this.graph;

      // ── Core capabilities ──
      graph.setPanning(true);
      graph.setTooltips(true);
      graph.setHtmlLabels(true);
      (graph as any).setEnabled?.(true);
      (graph as any).setCellsLocked?.(false);
      (graph as any).setCellsCloneable?.(true);
      (graph as any).setCellsDeletable?.(true);
      (graph as any).setCellsDisconnectable?.(true);
      (graph as any).setCellsBendable?.(true);
      (graph as any).setVertexLabelsMovable?.(true);
      (graph as any).setEdgeLabelsMovable?.(true);
      (graph as any).setDropEnabled?.(true);
      if ((graph as any).panningHandler) {
        (graph as any).panningHandler.useLeftButtonForPanning = false;
      }

      // ── EDITING: double-click to edit labels ──
      graph.setCellsEditable(true);

      // ── SELECTION + MOVE ──
      graph.setCellsSelectable(true);
      graph.setCellsMovable(true);

      // ── RESIZING: drag handles to resize ──
      graph.setCellsResizable(true);

      // ── CONNECTING: draw edges from connection points ──
      graph.setConnectable(true);
      graph.setAllowDanglingEdges(false);
      graph.setDisconnectOnMove(false);

      graph.isCellSelectable = (cell: any) => !!cell && !graph.isCellLocked(cell);
      graph.isCellMovable = (cell: any) => !!cell && !graph.isCellLocked(cell);
      graph.isCellResizable = (cell: any) => !!cell && !graph.isCellLocked(cell) && !(cell as any)?.edge;
      graph.isCellEditable = (cell: any) => !!cell && !graph.isCellLocked(cell);

      // ── CONNECTION POINTS: 4 cardinal points on every vertex ──
      graph.getAllConnectionConstraints = (terminal: any) => {
        if (terminal && terminal.shape) {
          return [
            new ConnectionConstraint(new Point(0.5, 0), true),
            new ConnectionConstraint(new Point(0.5, 1), true),
            new ConnectionConstraint(new Point(0, 0.5), true),
            new ConnectionConstraint(new Point(1, 0.5), true),
          ];
        }
        return [];
      };

      // ── UNDO/REDO ──
      this.undoManager = new UndoManager();
      const undoMgr = this.undoManager;
      const undoListener = (_sender: any, evt: any) => {
        undoMgr.undoableEditHappened(evt.getProperty('edit'));
      };
      graph.getDataModel().addListener(InternalEvent.UNDO, undoListener);
      graph.getView().addListener(InternalEvent.UNDO, undoListener);
      graph.getDataModel().addListener((InternalEvent as any).CHANGE, () => {
        if (!this.isApplyingRender) {
          this.emitDiagramChange();
        }
      });

      // ── RIGHT-CLICK CONTEXT MENU via native listener ──
      InternalEvent.disableContextMenu(container);
      container.addEventListener('contextmenu', (evt: MouseEvent) => {
        evt.preventDefault();
        evt.stopPropagation();
        if (!this.graph) return;
        const pt = this.graph.getPointForEvent(evt as any);
        const cell = this.graph.getCellAt(pt.x, pt.y);
        if (cell) {
          this.contextMenuCell = cell;
          this.contextMenuX = evt.clientX;
          this.contextMenuY = evt.clientY;
          this.contextMenuVisible = true;
        }
      });

      // ── EDGE STYLE defaults ──
      // Thicker strokes, darker default color, and filled classic arrowheads so
      // arrows read clearly at normal zoom without looking like thin pencil lines.
      // Manhattan routing with rounded corners keeps the primary user → edge →
      // app → data flow visually intentional.
      const edgeStyle = graph.getStylesheet().getDefaultEdgeStyle();
      edgeStyle.rounded = true;
      edgeStyle.strokeWidth = 2.4;
      edgeStyle.strokeColor = '#1F2937';
      edgeStyle.edgeStyle = 'orthogonalEdgeStyle';
      edgeStyle.curved = false;
      edgeStyle.endArrow = 'classic';
      edgeStyle.endSize = 14;
      edgeStyle.endFill = true;
      edgeStyle.startSize = 0;
      edgeStyle.jettySize = 'auto' as any;
      edgeStyle.orthogonalLoop = true;

      // ── VERTEX STYLE defaults ──
      const vertexStyle = graph.getStylesheet().getDefaultVertexStyle();
      vertexStyle.fontSize = 16;
      vertexStyle.fontFamily = 'Inter, system-ui, sans-serif';
      vertexStyle.rounded = true;
      vertexStyle.arcSize = 8;

      // ── Swimlane / container settings ──
      graph.isCellFoldable = () => false;

      // ── ZOOM: Mouse wheel + trackpad pinch (cursor-centered) ──
      InternalEvent.addMouseWheelListener((evt: Event, up: boolean) => {
        if (!this.graph) return;
        const wheelEvt = evt as WheelEvent;
        if (!wheelEvt.ctrlKey && !wheelEvt.metaKey) {
          return;
        }
        wheelEvt.preventDefault();

        const rect = container.getBoundingClientRect();
        const x = wheelEvt.clientX - rect.left;
        const y = wheelEvt.clientY - rect.top;
        this.applyZoom(up ? this.zoomFactor : 1 / this.zoomFactor, x, y);
      }, container);

      // ── PAN ──
      graph.setPanning(true);

      console.log('[maxGraph] Interactive editor initialized');
    } catch (err: any) {
      console.error('Error initializing maxGraph:', err);
      this.error = 'Failed to initialize diagram editor: ' + err.message;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Diagram rendering from DiagramSpec JSON
  // ═══════════════════════════════════════════════════════════════

  private async renderDiagram(): Promise<void> {
    if (!this.graph || !this.diagramData) return;

    this.edgeIndex = 0;
    this.sourcePortCounters = {};
    this.targetPortCounters = {};

    // Pre-fetch all icon URLs before rendering
    if (this.diagramData.nodes && Array.isArray(this.diagramData.nodes)) {
      const iconIds = this.diagramData.nodes
        .filter((node: any) => node.iconId)
        .map((node: any) => node.iconId);
      if (iconIds.length > 0) {
        await this.prefetchIconUrls(iconIds);
      }
    }

    const graph = this.graph;
    const parent = graph.getDefaultParent();

    try {
      this.isApplyingRender = true;
      graph.batchUpdate(() => {
        // Clear existing cells
        graph.removeCells(graph.getChildVertices(parent));

        const vertices: { [key: string]: Cell } = {};

        // Create containers first (they act as parent groups)
        if (this.diagramData.containers && Array.isArray(this.diagramData.containers)) {
          this.diagramData.containers.forEach((container: any) => {
            const x = container.geometry?.x ?? 0;
            const y = container.geometry?.y ?? 0;
            const width = container.geometry?.width ?? 400;
            const height = container.geometry?.height ?? 300;
            const style = this.buildContainerStyle(container);
            const containerParent = container.parentContainerId ? vertices[container.parentContainerId] : parent;

            const containerVertex = graph.insertVertex(
              containerParent, container.id, container.label || '',
              x, y, width, height, style
            );
            vertices[container.id] = containerVertex;
          });
        }

        // Create vertices
        if (this.diagramData.nodes && Array.isArray(this.diagramData.nodes)) {
          this.diagramData.nodes.forEach((node: any) => {
            const x = node.geometry?.x ?? node.x ?? 0;
            const y = node.geometry?.y ?? node.y ?? 0;
            const width = node.geometry?.width ?? node.width ?? 120;
            const height = node.geometry?.height ?? node.height ?? 120;
            const style = this.buildNodeStyle(node);
            const nodeParent = node.parentContainerId && vertices[node.parentContainerId]
              ? vertices[node.parentContainerId] : parent;

            const vertex = graph.insertVertex(
              nodeParent, node.id, node.label || node.id,
              x, y, width, height, style
            );
            vertices[node.id] = vertex;
          });
        }

        // Create edges
        if (this.diagramData.edges && Array.isArray(this.diagramData.edges)) {
          this.diagramData.edges.forEach((edge: any) => {
            const source = vertices[edge.from];
            const target = vertices[edge.to];
            if (source && target) {
              const edgeStyle = this.buildEdgeStyle(edge);
              graph.insertEdge(parent, edge.id || null,
                edge.label || '', source, target, edgeStyle);
            }
          });
        }
      });
    } catch (err: any) {
      console.error('Error rendering diagram:', err);
      this.error = 'Failed to render diagram: ' + err.message;
    } finally {
      this.isApplyingRender = false;
    }

    if (this.undoManager) {
      this.undoManager.clear();
    }

    this.fitGraphToContainer();
  }

  // ═══════════════════════════════════════════════════════════════
  // Drag-and-drop from Component Panel
  // ═══════════════════════════════════════════════════════════════

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (!this.graph || !event.dataTransfer) return;

    const data = event.dataTransfer.getData('application/json');
    if (!data) return;

    try {
      const item = JSON.parse(data);
      const pt = this.graph.getPointForEvent(event);
      this.insertComponentAtPoint(item, pt.x, pt.y);
    } catch (e) {
      console.warn('[maxGraph] Drop parse error:', e);
    }
  }

  /**
   * Public method: Insert a component from the panel at a position
   */
  public insertComponent(item: any): void {
    if (!this.graph) return;
    const view = this.graph.getView();
    const translate = view.getTranslate();
    const scale = view.getScale();
    const cx = translate.x + (this.graphContainer.nativeElement.offsetWidth / 2) / scale;
    const cy = translate.y + (this.graphContainer.nativeElement.offsetHeight / 2) / scale;
    this.insertComponentAtPoint(item, cx, cy);
  }

  private insertComponentAtPoint(item: any, x: number, y: number): void {
    if (!this.graph) return;
    const graph = this.graph;
    const parent = graph.getDefaultParent();

    graph.batchUpdate(() => {
      const id = `ins-${Date.now()}`;

      if (item.shapeType && this.isEdgeShapeType(item.shapeType)) {
        const edgeStyle = this.getEdgeShapeStyle(item.shapeType);
        const edge = graph.insertEdge(parent, id, '', null, null, edgeStyle);
        const geo = new Geometry(0, 0, 0, 0);
        geo.relative = true;
        const len = 150;
        const pts = this.getEdgePoints(item.shapeType, x, y, len);
        geo.setTerminalPoint(new Point(pts.x1, pts.y1), true);
        geo.setTerminalPoint(new Point(pts.x2, pts.y2), false);
        graph.getDataModel().setGeometry(edge, geo);
      } else if (item.shapeType) {
        const style = this.getShapeStyle(item.shapeType);
        const size = this.getShapeSize(item.shapeType);
        graph.insertVertex(parent, id, item.name || '', x, y, size.w, size.h, style);
      } else if (item.iconUrl) {
        const iconStyle: CellStyle = {
          shape: 'label',
          image: item.iconUrl,
          imageWidth: 48, imageHeight: 48,
          imageAlign: 'center',
          spacingTop: 6,
          fillColor: '#FFFFFF', strokeColor: '#DDDDDD', strokeWidth: 1.5,
          rounded: true, arcSize: 12,
          fontColor: '#333333', fontSize: 11, fontStyle: 1,
          align: 'center', verticalAlign: 'bottom', spacingBottom: 6, shadow: true,
        };
        graph.insertVertex(parent, id, item.name || '', x, y, 100, 90, iconStyle);
      } else {
        const genericStyle: CellStyle = {
          fillColor: '#FFFFFF', strokeColor: '#BDBDBD', strokeWidth: 1.5,
          rounded: true, arcSize: 12,
          fontColor: '#333333', fontSize: 12, shadow: true,
        };
        graph.insertVertex(parent, id, item.name || 'New Node', x, y, 120, 60, genericStyle);
      }
    });
  }

  private getShapeStyle(shapeType: string): CellStyle {
    const base: CellStyle = { fillColor: '#FFFFFF', strokeColor: '#333333', strokeWidth: 1.5, fontColor: '#333333' };
    switch (shapeType) {
      case 'rectangle':
        return { ...base, rounded: false, fontSize: 12 };
      case 'rounded-rectangle':
        return { ...base, rounded: true, arcSize: 12, fontSize: 12 };
      case 'circle':
        return { ...base, shape: 'ellipse', fontSize: 12, perimeter: 'ellipsePerimeter' };
      case 'diamond':
        return { ...base, shape: 'rhombus', fontSize: 11, perimeter: 'rhombusPerimeter' };
      case 'hexagon':
        return { ...base, shape: 'hexagon', fontSize: 11, perimeter: 'hexagonPerimeter' };
      case 'cylinder':
        return { ...base, shape: 'cylinder', fontSize: 11, whiteSpace: 'wrap' };
      case 'parallelogram':
        return { ...base, shape: 'rectangle', fontSize: 11 };
      case 'note':
        return { fillColor: '#FFFFCC', strokeColor: '#B3B300', strokeWidth: 1, fontSize: 11, fontColor: '#333333', whiteSpace: 'wrap', align: 'left', verticalAlign: 'top', spacingLeft: 8, spacingTop: 8 };
      case 'text':
        return { fillColor: 'none', strokeColor: 'none', fontSize: 14, fontColor: '#333333', align: 'center', verticalAlign: 'middle' };
      case 'group':
        return { baseStyleNames: ['swimlane'], fillColor: '#F5F5F5', strokeColor: '#999999', strokeWidth: 1.5, rounded: true, arcSize: 8, startSize: 28, fontSize: 12, fontStyle: 1, fontColor: '#333333', swimlaneLine: false };
      default:
        return { ...base, rounded: true, fontSize: 12 };
    }
  }

  private getShapeSize(shapeType: string): { w: number; h: number } {
    switch (shapeType) {
      case 'circle': return { w: 80, h: 80 };
      case 'diamond': return { w: 100, h: 80 };
      case 'hexagon': return { w: 100, h: 80 };
      case 'cylinder': return { w: 80, h: 100 };
      case 'note': return { w: 160, h: 100 };
      case 'text': return { w: 120, h: 30 };
      case 'group': return { w: 260, h: 200 };
      case 'parallelogram': return { w: 120, h: 60 };
      default: return { w: 120, h: 60 };
    }
  }

  private isEdgeShapeType(shapeType: string): boolean {
    return ['arrow-right', 'arrow-left', 'arrow-down', 'arrow-up', 'arrow-bidir', 'line', 'dashed-line'].includes(shapeType);
  }

  private getEdgeShapeStyle(shapeType: string): CellStyle {
    const base: CellStyle = { strokeColor: '#333333', strokeWidth: 2, rounded: true };
    switch (shapeType) {
      case 'arrow-right':
        return { ...base, endArrow: 'classic', endFill: true, endSize: 8 };
      case 'arrow-left':
        return { ...base, startArrow: 'classic', startFill: true, startSize: 8 };
      case 'arrow-down':
        return { ...base, endArrow: 'classic', endFill: true, endSize: 8 };
      case 'arrow-up':
        return { ...base, startArrow: 'classic', startFill: true, startSize: 8 };
      case 'arrow-bidir':
        return { ...base, endArrow: 'classic', endFill: true, endSize: 8, startArrow: 'classic', startFill: true, startSize: 8 };
      case 'line':
        return { ...base };
      case 'dashed-line':
        return { ...base, dashed: true, dashPattern: '8 4' };
      default:
        return { ...base, endArrow: 'classic', endFill: true, endSize: 8 };
    }
  }

  private getEdgePoints(shapeType: string, x: number, y: number, len: number): { x1: number; y1: number; x2: number; y2: number } {
    switch (shapeType) {
      case 'arrow-down':
        return { x1: x, y1: y, x2: x, y2: y + len };
      case 'arrow-up':
        return { x1: x, y1: y + len, x2: x, y2: y };
      case 'arrow-left':
        return { x1: x + len, y1: y, x2: x, y2: y };
      case 'arrow-right':
      case 'arrow-bidir':
      case 'line':
      case 'dashed-line':
      default:
        return { x1: x, y1: y, x2: x + len, y2: y };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Context menu actions
  // ═══════════════════════════════════════════════════════════════

  ctxEdit(): void {
    this.contextMenuVisible = false;
    if (this.contextMenuCell && this.graph) {
      this.graph.startEditingAtCell(this.contextMenuCell);
    }
  }

  ctxDuplicate(): void {
    this.contextMenuVisible = false;
    if (this.contextMenuCell && this.graph) {
      const cells = this.graph.cloneCells([this.contextMenuCell]);
      if (cells && cells.length > 0) {
        const geo = cells[0].getGeometry();
        if (geo) {
          geo.x += 20;
          geo.y += 20;
        }
        this.graph.addCells(cells, this.graph.getDefaultParent(), null, null, null);
        this.graph.setSelectionCells(cells);
      }
    }
  }

  ctxToFront(): void {
    this.contextMenuVisible = false;
    if (this.contextMenuCell && this.graph) {
      this.graph.orderCells(false, [this.contextMenuCell]);
    }
  }

  ctxToBack(): void {
    this.contextMenuVisible = false;
    if (this.contextMenuCell && this.graph) {
      this.graph.orderCells(true, [this.contextMenuCell]);
    }
  }

  ctxDelete(): void {
    this.contextMenuVisible = false;
    if (this.contextMenuCell && this.graph) {
      this.graph.removeCells([this.contextMenuCell]);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Undo / Redo
  // ═══════════════════════════════════════════════════════════════

  public undo(): void {
    if (this.undoManager) this.undoManager.undo();
  }

  public redo(): void {
    if (this.undoManager) this.undoManager.redo();
  }

  private emitDiagramChange(): void {
    const nextDiagram = this.serializeCurrentDiagram();
    if (nextDiagram) {
      this.diagramChanged.emit(nextDiagram);
    }
  }

  private serializeCurrentDiagram(): any {
    if (!this.graph || !this.diagramData) return null;

    const model = this.graph.getDataModel() as any;
    const resolveCell = (id: string) => model?.getCell?.(id);
    const cloneGeometry = (geometry: any, fallback: any = {}) => ({
      ...(fallback || {}),
      x: geometry?.x ?? fallback?.x ?? 0,
      y: geometry?.y ?? fallback?.y ?? 0,
      width: geometry?.width ?? fallback?.width ?? 0,
      height: geometry?.height ?? fallback?.height ?? 0,
    });

    return {
      ...this.diagramData,
      containers: (this.diagramData.containers || []).map((container: any) => {
        const cell = resolveCell(container.id);
        const geometry = cell?.getGeometry?.();
        return {
          ...container,
          label: cell?.value ?? container.label,
          geometry: cloneGeometry(geometry, container.geometry),
        };
      }),
      nodes: (this.diagramData.nodes || []).map((node: any) => {
        const cell = resolveCell(node.id);
        const geometry = cell?.getGeometry?.();
        return {
          ...node,
          label: cell?.value ?? node.label,
          geometry: cloneGeometry(geometry, node.geometry),
        };
      }),
      edges: (this.diagramData.edges || []).map((edge: any) => {
        const cell = resolveCell(edge.id);
        return {
          ...edge,
          label: cell?.value ?? edge.label,
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Layout & zoom
  // ═══════════════════════════════════════════════════════════════

  private fitGraphToContainer(): void {
    if (!this.graph) return;
    try {
      const margin = 30;
      const bounds = this.graph.getGraphBounds();
      const container = this.graphContainer.nativeElement;
      const width = container.offsetWidth - 2 * margin;
      const height = container.offsetHeight - 2 * margin;

      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const maxScale = this.isC4Diagram()
          ? ((bounds.width > 1400 || bounds.height > 950) ? 1.0 : 1.18)
          : ((bounds.width > 1200 || bounds.height > 800) ? 0.85 : 1.2);
        const computedScale = Math.min(width / bounds.width, height / bounds.height, maxScale);
        const scale = this.isC4Diagram() ? Math.max(computedScale, 0.92) : computedScale;
        const view = this.graph.getView();
        view.setScale(scale);
        const dx = margin - bounds.x * scale + (width - bounds.width * scale) / 2;
        const dy = margin - bounds.y * scale + (height - bounds.height * scale) / 2;
        view.setTranslate(dx / scale, dy / scale);
      }
    } catch (err) {
      console.error('Error fitting graph:', err);
    }
  }

  private applyZoom(factor: number, x?: number, y?: number): void {
    if (!this.graph || !this.graphContainer) return;

    const container = this.graphContainer.nativeElement as HTMLDivElement;
    const view = this.graph.getView();
    const scale = view.getScale();
    const targetScale = Math.max(this.minScale, Math.min(scale * factor, this.maxScale));

    if (!Number.isFinite(targetScale) || targetScale === scale) {
      return;
    }

    const zoomX = x ?? container.offsetWidth / 2;
    const zoomY = y ?? container.offsetHeight / 2;
    const translate = view.getTranslate();
    view.setScale(targetScale);
    view.setTranslate(
      translate.x - (zoomX / scale - zoomX / targetScale),
      translate.y - (zoomY / scale - zoomY / targetScale)
    );
  }

  public zoomIn(): void {
    this.applyZoom(this.zoomFactor);
  }

  public zoomOut(): void {
    this.applyZoom(1 / this.zoomFactor);
  }

  public resetZoom(): void {
    this.fitGraphToContainer();
  }

  public fitToScreen(): void {
    this.fitGraphToContainer();
  }

  // ═══════════════════════════════════════════════════════════════
  // Icon helpers
  // ═══════════════════════════════════════════════════════════════

  private prefetchIconUrls(iconIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(iconIds)];
    const fetchPromises = uniqueIds.map(iconId => {
      if (this.iconUrlCache.has(iconId)) return Promise.resolve();
      return new Promise<void>((resolve) => {
        this.iconService.getIconUrl(iconId).subscribe({
          next: (url) => { this.iconUrlCache.set(iconId, url); resolve(); },
          error: () => {
            // IconService already handles fallback, but belt-and-suspenders
            this.iconUrlCache.set(iconId, this.GENERIC_FALLBACK_ICON);
            resolve();
          }
        });
      });
    });
    return Promise.all(fetchPromises).then(() => {});
  }

  /** Data-URI fallback icon — guaranteed to never be blank/broken */
  private readonly GENERIC_FALLBACK_ICON = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%236366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>'
  )}`;

  private getIconUrl(iconId: string): string {
    if (this.iconUrlCache.has(iconId)) return this.iconUrlCache.get(iconId)!;
    // Never return a URL that could show blank — use data-URI fallback
    return this.GENERIC_FALLBACK_ICON;
  }

  // ═══════════════════════════════════════════════════════════════
  // Style builders
  // ═══════════════════════════════════════════════════════════════

  // ── Tier-based fallback colors (matches LayoutEngineServiceImpl TIER_STYLES) ──
  // Font sizes and header heights bumped +2-3pt across all tiers for enterprise
  // readability at normal zoom. Boundary labels (cloud / region / VPC) read as
  // titles, subnet labels read as headings, and the side bands align cleanly.
  private static readonly TIER_DEFAULTS: Record<string, {fill: string; stroke: string; font: string; fontSize: number; arcSize: number; shadow: boolean; fontStyle: number; startSize: number}> = {
    'cloud':         {fill: '#F8F9FA', stroke: '#FF9900', font: '#1F2937', fontSize: 19, arcSize: 14, shadow: true,  fontStyle: 1, startSize: 52},
    'region':        {fill: '#FAFAFA', stroke: '#546E7A', font: '#263238', fontSize: 18, arcSize: 12, shadow: false, fontStyle: 1, startSize: 48},
    'vpc':           {fill: '#F5F7FA', stroke: '#1565C0', font: '#0D47A1', fontSize: 18, arcSize: 12, shadow: false, fontStyle: 1, startSize: 48},
    'az':            {fill: '#FAFBFC', stroke: '#90A4AE', font: '#37474F', fontSize: 17, arcSize: 8,  shadow: false, fontStyle: 1, startSize: 44},
    'subnet_public': {fill: '#E8F5E9', stroke: '#2E7D32', font: '#1B5E20', fontSize: 16, arcSize: 6,  shadow: false, fontStyle: 1, startSize: 42},
    'subnet_app':    {fill: '#E3F2FD', stroke: '#1565C0', font: '#0D47A1', fontSize: 16, arcSize: 6,  shadow: false, fontStyle: 1, startSize: 42},
    'subnet_data':   {fill: '#EDE7F6', stroke: '#6A1B9A', font: '#4A148C', fontSize: 16, arcSize: 6,  shadow: false, fontStyle: 1, startSize: 42},
    'external':      {fill: '#FAFAFA', stroke: '#78909C', font: '#263238', fontSize: 17, arcSize: 10, shadow: false, fontStyle: 1, startSize: 44},
    'edge_services': {fill: '#FFF8E1', stroke: '#F57F17', font: '#BF360C', fontSize: 16, arcSize: 8,  shadow: false, fontStyle: 1, startSize: 44},
    'security_band': {fill: '#FCE4EC', stroke: '#C62828', font: '#B71C1C', fontSize: 17, arcSize: 10, shadow: true,  fontStyle: 1, startSize: 44},
    'cicd_band':     {fill: '#E0F2F1', stroke: '#00695C', font: '#004D40', fontSize: 16, arcSize: 8,  shadow: false, fontStyle: 1, startSize: 44},
    'site':          {fill: '#F3E5F5', stroke: '#7B1FA2', font: '#4A148C', fontSize: 18, arcSize: 12, shadow: true,  fontStyle: 1, startSize: 48},
    'integration':   {fill: '#FFF3E0', stroke: '#E65100', font: '#BF360C', fontSize: 16, arcSize: 8,  shadow: false, fontStyle: 1, startSize: 42},
  };

  // ── Provider-specific visual theme ──────────────────────────────
  // Each provider gets its own accent color, cloud border color, and container
  // overrides so Azure renders in Microsoft reference-architecture style
  // (pale blue VNet, dashed blue border, blue accent) while AWS keeps its
  // orange accent and GCP its multi-color pastel palette. Tier defaults still
  // provide the base layout — the theme applies ONLY colors and stroke modes
  // on top, so the same shared topology strategies render consistently across
  // providers with the correct visual language.
  private static readonly PROVIDER_THEMES: Record<string, {
    accent: string;
    cloudStroke: string;
    vpcFill: string;
    vpcStroke: string;
    vpcFont: string;
    vpcDashed: boolean;
    subnetApp: { fill: string; stroke: string; font: string };
    subnetData: { fill: string; stroke: string; font: string };
    subnetPublic: { fill: string; stroke: string; font: string };
    securityBand: { fill: string; stroke: string; font: string };
    edgeColor: string;
    asyncEdgeColor: string;
    asyncEdgeDash: string;
    nodeStroke: string;
  }> = {
    'azure': {
      accent: '#0078D4',
      cloudStroke: '#F2A93B',
      vpcFill: '#F5F9FD',
      vpcStroke: '#3A87C8',
      vpcFont: '#0B5394',
      vpcDashed: true,
      subnetApp:    { fill: '#EAF3FB', stroke: '#3A87C8', font: '#0B5394' },
      subnetData:   { fill: '#F3EAF7', stroke: '#8051A6', font: '#4A148C' },
      subnetPublic: { fill: '#EAF6EC', stroke: '#4D9656', font: '#1B5E20' },
      securityBand: { fill: '#FDECEC', stroke: '#C8474E', font: '#8B1A1F' },
      edgeColor: '#4B5563',
      asyncEdgeColor: '#7A879B',
      asyncEdgeDash: '6 3',
      nodeStroke: '#D4DBE5',
    },
    'aws': {
      accent: '#FF9900',
      cloudStroke: '#FF9900',
      vpcFill: '#F5F7FA',
      vpcStroke: '#1565C0',
      vpcFont: '#0D47A1',
      vpcDashed: false,
      subnetApp:    { fill: '#E3F2FD', stroke: '#1565C0', font: '#0D47A1' },
      subnetData:   { fill: '#EDE7F6', stroke: '#6A1B9A', font: '#4A148C' },
      subnetPublic: { fill: '#E8F5E9', stroke: '#2E7D32', font: '#1B5E20' },
      securityBand: { fill: '#FCE4EC', stroke: '#C62828', font: '#B71C1C' },
      edgeColor: '#232F3E',
      asyncEdgeColor: '#7A879B',
      asyncEdgeDash: '8 4',
      nodeStroke: '#D5DAE1',
    },
    'gcp': {
      accent: '#4285F4',
      cloudStroke: '#4285F4',
      vpcFill: '#F3F7FF',
      vpcStroke: '#4285F4',
      vpcFont: '#1A73E8',
      vpcDashed: false,
      subnetApp:    { fill: '#E8F0FE', stroke: '#4285F4', font: '#1A73E8' },
      subnetData:   { fill: '#FCE8E6', stroke: '#EA4335', font: '#B31412' },
      subnetPublic: { fill: '#E6F4EA', stroke: '#34A853', font: '#137333' },
      securityBand: { fill: '#FEF7E0', stroke: '#F9AB00', font: '#B06000' },
      edgeColor: '#5F6368',
      asyncEdgeColor: '#80868B',
      asyncEdgeDash: '6 3',
      nodeStroke: '#DADCE0',
    },
    'on-prem': {
      accent: '#6A4C93',
      cloudStroke: '#7B1FA2',
      vpcFill: '#F6F2F9',
      vpcStroke: '#7B1FA2',
      vpcFont: '#4A148C',
      vpcDashed: false,
      subnetApp:    { fill: '#EEE4F4', stroke: '#7B1FA2', font: '#4A148C' },
      subnetData:   { fill: '#EDE7F6', stroke: '#6A1B9A', font: '#4A148C' },
      subnetPublic: { fill: '#E8F5E9', stroke: '#2E7D32', font: '#1B5E20' },
      securityBand: { fill: '#FCE4EC', stroke: '#C62828', font: '#B71C1C' },
      edgeColor: '#4B5563',
      asyncEdgeColor: '#9CA3AF',
      asyncEdgeDash: '6 3',
      nodeStroke: '#D1D5DB',
    },
    'generic': {
      accent: '#6366F1',
      cloudStroke: '#9CA3AF',
      vpcFill: '#F5F7FA',
      vpcStroke: '#6B7280',
      vpcFont: '#374151',
      vpcDashed: false,
      subnetApp:    { fill: '#F3F4F6', stroke: '#6B7280', font: '#374151' },
      subnetData:   { fill: '#EDE7F6', stroke: '#6A1B9A', font: '#4A148C' },
      subnetPublic: { fill: '#E8F5E9', stroke: '#2E7D32', font: '#1B5E20' },
      securityBand: { fill: '#FCE4EC', stroke: '#C62828', font: '#B71C1C' },
      edgeColor: '#6B7280',
      asyncEdgeColor: '#9CA3AF',
      asyncEdgeDash: '6 3',
      nodeStroke: '#DDDDDD',
    },
  };

  /** Normalize whatever the backend sends into one of azure|aws|gcp|on-prem|generic. */
  private resolveProvider(): string {
    const raw = (this.diagramData?.cloudProvider
              ?? this.diagramData?.provider
              ?? this.diagramData?.renderPolicy?.actualProvider
              ?? 'generic').toString().toLowerCase();
    if (raw.includes('azure') || raw.includes('microsoft')) return 'azure';
    if (raw.includes('aws') || raw.includes('amazon')) return 'aws';
    if (raw.includes('gcp') || raw.includes('google')) return 'gcp';
    if (raw.includes('on-prem') || raw.includes('onprem') || raw.includes('on_prem')
        || raw.includes('datacenter') || raw.includes('data center')
        || raw.includes('vmware') || raw.includes('bare metal')) return 'on-prem';
    return 'generic';
  }

  private resolveProviderTheme() {
    const provider = this.resolveProvider();
    return (MaxGraphCanvasComponent.PROVIDER_THEMES as any)[provider]
        || MaxGraphCanvasComponent.PROVIDER_THEMES['generic'];
  }

  /** Pick the provider-theme container overrides for a given tier id. */
  private providerContainerOverride(tier: string): { fill?: string; stroke?: string; font?: string; dashed?: boolean } | null {
    const theme = this.resolveProviderTheme();
    switch (tier) {
      case 'cloud':         return { stroke: theme.cloudStroke };
      case 'vpc':           return { fill: theme.vpcFill, stroke: theme.vpcStroke, font: theme.vpcFont, dashed: theme.vpcDashed };
      case 'subnet_app':    return { fill: theme.subnetApp.fill,  stroke: theme.subnetApp.stroke,  font: theme.subnetApp.font };
      case 'subnet_data':   return { fill: theme.subnetData.fill, stroke: theme.subnetData.stroke, font: theme.subnetData.font };
      case 'subnet_public': return { fill: theme.subnetPublic.fill, stroke: theme.subnetPublic.stroke, font: theme.subnetPublic.font };
      case 'security_band': return { fill: theme.securityBand.fill, stroke: theme.securityBand.stroke, font: theme.securityBand.font };
      default: return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // C4-specific detection
  // ═══════════════════════════════════════════════════════════════

  private isC4Diagram(): boolean {
    return this.diagramData?.metadata?.c4ViewFamily === 'c4'
        || (this.diagramData?.diagramType || '').startsWith('c4-');
  }

  private buildContainerStyle(container: any): CellStyle {
    // C4 boundary containers use a distinct transparent style
    if (this.isC4Diagram()) {
      return this.buildC4ContainerStyle(container);
    }

    const style = container.style || {};
    const tier = container.tier || container.metadata?.tier || '';
    const td = (MaxGraphCanvasComponent.TIER_DEFAULTS as any)[tier] ||
               {fill: '#FAFAFA', stroke: '#BDBDBD', font: '#1F2937', fontSize: 16, arcSize: 8, shadow: false, fontStyle: 1, startSize: 42};

    // Apply provider-specific theme on top of tier defaults. Explicit container
    // style (from the backend) still wins — the theme only fills in the
    // provider's visual language when the backend hasn't pinned a color.
    const override = this.providerContainerOverride(tier);
    const fill = style.fillColor || override?.fill || td.fill;
    const stroke = style.strokeColor || override?.stroke || td.stroke;
    const font = style.fontColor || style.headerTextColor || override?.font || td.font;

    const result: CellStyle = {
      baseStyleNames: ['swimlane'],
      fillColor: fill,
      strokeColor: stroke,
      strokeWidth: style.strokeWidth || (td.shadow ? 2.5 : 1.5),
      rounded: true,
      arcSize: style.cornerRadius || td.arcSize,
      fontColor: font,
      fontSize: style.fontSize || td.fontSize,
      fontStyle: td.fontStyle,
      align: 'left',
      verticalAlign: 'top',
      startSize: style.headerHeight || td.startSize,
      spacingLeft: 10,
      spacingTop: 2,
      swimlaneFillColor: style.headerColor || style.fillColor || override?.fill || td.fill,
      swimlaneLine: false,
      shadow: td.shadow,
    };
    if (style.dashed || override?.dashed) {
      result.dashed = true;
      result.dashPattern = '8 4';
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // C4 Container (boundary) style builder
  // ═══════════════════════════════════════════════════════════════

  private buildC4ContainerStyle(container: any): CellStyle {
    const style = container.style || {};
    const cType = container.type || '';

    const result: CellStyle = {
      baseStyleNames: ['swimlane'],
      fillColor: style.fillColor || 'none',
      strokeColor: style.strokeColor || '#C7CDD4',
      strokeWidth: style.strokeWidth || 1.8,
      rounded: true,
      arcSize: style.arcSize || 12,
      fontColor: style.fontColor || '#4B5563',
      fontSize: style.fontSize || 16,
      fontStyle: 1,
      align: 'left',
      verticalAlign: 'top',
      startSize: style.startSize || 42,
      spacingLeft: 16,
      spacingTop: 10,
      swimlaneFillColor: 'none',
      swimlaneLine: false,
      shadow: false,
      dashed: style.dashed === '1' || style.dashed === true,
      dashPattern: style.dashPattern || '8 4',
      movable: true,
      resizable: true,
      editable: true,
      deletable: true,
    };

    // System boundary: solid stroke
    if (cType === 'system-boundary') {
      result.dashed = false;
      result.strokeWidth = style.strokeWidth || 2;
    }
    // Container boundary: dashed
    if (cType === 'container-boundary') {
      result.dashed = true;
    }

    return result;
  }

  private buildNodeStyle(node: any): CellStyle {
    // C4-specific node rendering
    const c4Type = node.metadata?.c4NodeType || '';
    if (c4Type && this.isC4Diagram()) {
      return this.buildC4NodeStyle(node, c4Type);
    }

    const style = node.style || {};
    // Provider theme provides a subtle node border color that matches the
    // cloud's visual language (Azure softer blue-gray, AWS warm gray, etc.).
    const theme = this.resolveProviderTheme();
    // Icon dimensions resolved by the diagram-service icon lookup; fall
    // back to 56px if none. Keeping the icon constrained to its declared
    // size prevents the asynchronous-fallback flash where a 64px image is
    // dropped into a 56px slot and overflows the rounded label.
    const iconW = Number(node.metadata?.iconWidth)
        || Number(style.imageWidth)
        || 56;
    const iconH = Number(node.metadata?.iconHeight)
        || Number(style.imageHeight)
        || 56;
    if (style.renderMode === 'icon-label' && node.iconId) {
      const iconUrl = this.getIconUrl(node.iconId);
      return {
        shape: 'label',
        image: iconUrl,
        imageWidth: iconW,
        imageHeight: iconH,
        imageAlign: 'center',
        fillColor: 'none',
        strokeColor: 'none',
        strokeWidth: 0,
        rounded: false,
        shadow: false,
        fontColor: style.fontColor || '#1F2937',
        fontSize: Number(style.fontSize) || 15,
        fontStyle: Number(style.fontStyle) || 1,
        align: 'center',
        verticalAlign: 'bottom',
        verticalLabelPosition: 'bottom' as any,
        spacingTop: 10,
        spacingBottom: 0,
        whiteSpace: 'wrap',
        overflow: 'fill',
      };
    }
    if (node.iconId) {
      const iconUrl = this.getIconUrl(node.iconId);
      return {
        shape: 'label',
        image: iconUrl,
        imageWidth: iconW,
        imageHeight: iconH,
        imageAlign: 'center',
        spacingTop: 8,
        fillColor: style.fillColor || '#FFFFFF',
        strokeColor: style.strokeColor || theme.nodeStroke,
        strokeWidth: style.strokeWidth || 1.5,
        rounded: true,
        arcSize: 12,
        fontColor: '#1F2937',
        fontSize: 15,
        fontStyle: 1,
        align: 'center',
        verticalAlign: 'bottom',
        spacingBottom: 8,
        shadow: true,
        overflow: 'hidden',
        whiteSpace: 'wrap',
      };
    }
    return {
      fillColor: style.fillColor || '#FFFFFF',
      strokeColor: style.strokeColor || theme.nodeStroke,
      strokeWidth: style.strokeWidth || 1.5,
      rounded: true,
      arcSize: 12,
      fontColor: '#1F2937',
      fontSize: 15,
      fontStyle: style.fontStyle === 'bold' ? 1 : 0,
      align: 'center',
      verticalAlign: 'middle',
      shadow: true,
      overflow: 'hidden',
      whiteSpace: 'wrap',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // C4 Node style builder — enterprise-grade C4 visual primitives
  // ═══════════════════════════════════════════════════════════════

  private buildC4NodeStyle(node: any, c4Type: string): CellStyle {
    const style = node.style || {};
    const commonStyle: CellStyle = {
      fillColor: style.fillColor || '#FFFFFF',
      strokeColor: style.strokeColor || '#6B7280',
      strokeWidth: style.strokeWidth || 1.8,
      fontColor: style.fontColor || '#374151',
      fontSize: style.fontSize || 16,
      fontStyle: style.fontStyle || 1,
      rounded: true,
      arcSize: style.arcSize || 14,
      align: 'center',
      verticalAlign: style.verticalAlign || 'middle',
      whiteSpace: 'wrap',
      shadow: false,
      spacingTop: style.spacingTop || 8,
      spacingBottom: style.spacingBottom || 8,
      spacingLeft: style.spacingLeft || 18,
      spacingRight: style.spacingRight || 18,
      movable: true,
      resizable: true,
      editable: true,
      deletable: true,
    };

    switch (c4Type) {
      case 'person': {
        return {
          ...commonStyle,
          arcSize: style.arcSize || 16,
          strokeWidth: style.strokeWidth || 1.9,
          fontSize: style.fontSize || 17,
        };
      }
      case 'software-system': {
        return {
          ...commonStyle,
          strokeColor: style.strokeColor || '#4B5563',
          fontColor: style.fontColor || '#1F2937',
          fontSize: style.fontSize || 20,
          strokeWidth: style.strokeWidth || 2.1,
          arcSize: style.arcSize || 16,
        };
      }
      case 'software-system-ext': {
        return {
          ...commonStyle,
          strokeColor: style.strokeColor || '#9CA3AF',
          fontSize: style.fontSize || 17,
          dashed: true,
          dashPattern: style.dashPattern || '10 5',
        };
      }
      case 'container': {
        return {
          ...commonStyle,
          fontSize: style.fontSize || 17,
        };
      }
      case 'container-db': {
        return {
          ...commonStyle,
          shape: 'cylinder',
          fontSize: style.fontSize || 16,
        };
      }
      case 'container-queue': {
        return {
          ...commonStyle,
          fontSize: style.fontSize || 16,
          dashed: true,
          dashPattern: style.dashPattern || '6 3',
        };
      }
      case 'component': {
        return {
          ...commonStyle,
          fontSize: style.fontSize || 15,
          arcSize: style.arcSize || 10,
        };
      }
      case 'component-adapter': {
        return {
          ...commonStyle,
          fontSize: style.fontSize || 15,
          arcSize: style.arcSize || 10,
          dashed: style.dashed === '1' || style.dashed === true,
          dashPattern: style.dashPattern || '6 3',
        };
      }
      default: {
        return {
          ...commonStyle,
        };
      }
    }
  }

  private edgeIndex = 0;
  private sourcePortCounters: { [key: string]: number } = {};
  private targetPortCounters: { [key: string]: number } = {};

  private buildEdgeStyle(edge: any): CellStyle {
    // C4 edges get cleaner Manhattan routing
    if (this.isC4Diagram()) {
      return this.buildC4EdgeStyle(edge);
    }
    const style = edge.style || {};

    const srcId = edge.from || '';
    const tgtId = edge.to || '';
    const srcCount = this.sourcePortCounters[srcId] || 0;
    const tgtCount = this.targetPortCounters[tgtId] || 0;
    this.sourcePortCounters[srcId] = srcCount + 1;
    this.targetPortCounters[tgtId] = tgtCount + 1;

    const jettyBase = 10;
    const jettyOffset = jettyBase + (this.edgeIndex % 6) * 5;
    this.edgeIndex++;

    const exitSpacing = 4 + srcCount * 3;
    const entrySpacing = 4 + tgtCount * 3;
    const exitDx = (srcCount % 3 === 0) ? 0 : (srcCount % 3 === 1) ? 1 : -1;
    const entryDx = (tgtCount % 3 === 0) ? 0 : (tgtCount % 3 === 1) ? 1 : -1;

    // Shorter label — truncate long edge labels to reduce visual noise
    const rawLabel = edge.label || '';
    const truncLabel = rawLabel.length > 20 ? rawLabel.substring(0, 18) + '…' : rawLabel;
    if (truncLabel !== rawLabel) edge.label = truncLabel;

    // Apply provider-specific edge color (Azure subtle blue-gray, AWS deep
    // navy, GCP Google gray). Async / auth / control flows use the dashed
    // variant — matches the Microsoft reference-architecture visual language
    // where HTTPS is solid and authentication/async are dashed.
    const theme = this.resolveProviderTheme();
    const flowType = (style.flowType || edge.metadata?.flowType || edge.type || 'sync').toString().toLowerCase();
    const isAsync = flowType === 'async' || flowType === 'event' || flowType === 'auth'
                 || flowType === 'replication' || flowType === 'control'
                 || style.dashed === '1' || style.dashed === true;
    const themedStroke = isAsync ? theme.asyncEdgeColor : theme.edgeColor;

    // Thicker strokes, darker default color, and filled classic arrowheads so
    // flow direction is unambiguous. Labels render on a near-opaque white
    // background with higher-contrast text so they stay legible when they
    // sit on top of boundary fills.
    const result: CellStyle = {
      strokeColor: style.strokeColor || themedStroke,
      strokeWidth: style.strokeWidth || 2.4,
      endArrow: style.endArrow || 'classic',
      endSize: style.endSize || 14,
      endFill: true,
      rounded: style.rounded !== false,
      curved: false,
      edgeStyle: style.edgeStyle || 'orthogonalEdgeStyle',
      jettySize: jettyOffset,
      orthogonalLoop: true,
      entryPerimeter: true,
      exitPerimeter: true,
      sourcePerimeterSpacing: exitSpacing,
      targetPerimeterSpacing: entrySpacing,
      exitDx: exitDx * 8,
      entryDx: entryDx * 8,
      fontSize: style.fontSize || 14,
      fontColor: style.fontColor || themedStroke,
      fontStyle: 1,
      labelBackgroundColor: '#FFFFFFF2',
      labelBorderColor: 'none',
      labelPadding: 4,
      spacingTop: -2,
    };
    if (style.startArrow) {
      result.startArrow = style.startArrow;
      result.startSize = style.startSize || 10;
      result.startFill = true;
    }
    if (style.dashed || isAsync) {
      result.dashed = true;
      result.dashPattern = style.dashPattern || theme.asyncEdgeDash;
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // C4 Edge style builder — clean Manhattan routing
  // ═══════════════════════════════════════════════════════════════

  private buildC4EdgeStyle(edge: any): CellStyle {
    const style = edge.style || {};
    const flowType = (style.flowType || edge.metadata?.flowType || 'sync').toString().toLowerCase();
    const isAsync = flowType === 'async' || style.dashed === '1' || style.dashed === true;
    const jettySize = Number(style.jettySize);
    const sourcePerimeterSpacing = Number(style.sourcePerimeterSpacing);
    const targetPerimeterSpacing = Number(style.targetPerimeterSpacing);

    const result: CellStyle = {
      edgeStyle: 'orthogonalEdgeStyle',
      rounded: style.rounded === true || style.rounded === '1',
      orthogonalLoop: true,
      jettySize: Number.isFinite(jettySize) ? jettySize : 32,
      strokeColor: style.strokeColor || '#6B7280',
      strokeWidth: style.strokeWidth || 2,
      endArrow: style.endArrow || 'classic',
      endSize: style.endSize || 10,
      endFill: true,
      fontSize: style.fontSize || 13,
      fontColor: style.fontColor || '#4B5563',
      fontStyle: style.fontStyle || 1,
      labelBackgroundColor: '#FFFFFFF2',
      labelBorderColor: 'none',
      labelPadding: 4,
      entryPerimeter: true,
      exitPerimeter: true,
      sourcePerimeterSpacing: Number.isFinite(sourcePerimeterSpacing) ? sourcePerimeterSpacing : 12,
      targetPerimeterSpacing: Number.isFinite(targetPerimeterSpacing) ? targetPerimeterSpacing : 12,
    };
    if (style.exitX !== undefined) result.exitX = Number(style.exitX);
    if (style.exitY !== undefined) result.exitY = Number(style.exitY);
    if (style.entryX !== undefined) result.entryX = Number(style.entryX);
    if (style.entryY !== undefined) result.entryY = Number(style.entryY);
    if (flowType === 'audit') {
      result.strokeColor = style.strokeColor || '#F97316';
      result.strokeWidth = style.strokeWidth || 1.7;
      result.dashed = true;
      result.dashPattern = style.dashPattern || '2 6';
    } else if (flowType === 'document') {
      result.strokeColor = style.strokeColor || '#16A34A';
      result.strokeWidth = style.strokeWidth || 1.9;
      result.dashed = false;
    } else if (isAsync) {
      result.strokeColor = style.strokeColor || '#7C3AED';
      result.dashed = true;
      result.dashPattern = style.dashPattern || '10 6';
    } else {
      result.strokeColor = style.strokeColor || '#8B8F97';
    }
    if (style.startArrow) {
      result.startArrow = style.startArrow;
      result.startSize = style.startSize || 7;
      result.startFill = true;
    }
    const rawLabel = (edge.label || '').trim();
    if (rawLabel && !['null', 'undefined', 'none'].includes(rawLabel.toLowerCase())) {
      edge.label = rawLabel.length > 28 ? rawLabel.substring(0, 27) + '…' : rawLabel;
    } else {
      edge.label = '';
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════

  /** Expose the live SVG element so DiagramExportService can rasterise it. */
  public getSvgElement(): SVGElement | null {
    if (!this.graphContainer) return null;
    return this.graphContainer.nativeElement.querySelector('svg') as SVGElement | null;
  }

  public downloadAsPNG(): void {
    if (!this.graph) return;
    try {
      const svgElement = this.graphContainer.nativeElement.querySelector('svg');
      if (svgElement) {
        const svgClone = svgElement.cloneNode(true) as SVGElement;
        const bounds = this.graph.getGraphBounds();
        const scale = this.graph.getView().getScale();
        const padding = 40;
        const width = (bounds.width + bounds.x) * scale + padding;
        const height = (bounds.height + bounds.y) * scale + padding;
        svgClone.setAttribute('width', width.toString());
        svgClone.setAttribute('height', height.toString());
        const svgData = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `diagram-${Date.now()}.png`;
                link.href = url; link.click();
                URL.revokeObjectURL(url);
              }
            }, 'image/png');
          }
          URL.revokeObjectURL(svgUrl);
        };
        img.onerror = () => {
          const link = document.createElement('a');
          link.download = `diagram-${Date.now()}.svg`;
          link.href = svgUrl; link.click();
          URL.revokeObjectURL(svgUrl);
        };
        img.src = svgUrl;
      }
    } catch (err) {
      console.error('Error downloading diagram:', err);
    }
  }
}
