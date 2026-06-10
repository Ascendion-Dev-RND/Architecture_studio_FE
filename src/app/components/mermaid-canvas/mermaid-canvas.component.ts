import { Component, Input, OnInit, OnChanges, SimpleChanges, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import mermaid from 'mermaid';

/**
 * MermaidCanvas Component
 * 
 * Renders Mermaid diagrams from text-based syntax
 * Supports: Sequence, Flowchart, ER Diagrams, etc.
 */
@Component({
  selector: 'app-mermaid-canvas',
  standalone: true,
  template: `
    <div class="mermaid-container w-full h-full overflow-auto rounded-lg p-6">
      <div #mermaidDiv class="mermaid-content" [style.transform]="'scale(' + zoomLevel + ')'"></div>
    </div>
  `,
  styles: [`
    .mermaid-container {
      min-height: 400px;
      background-color: #E8ECF1;
      background-image: radial-gradient(circle, #C8CDD5 1px, transparent 1px);
      background-size: 20px 20px;
    }
    .mermaid-content {
      display: flex;
      justify-content: center;
      align-items: center;
      transform-origin: center center;
      transition: transform 0.2s ease-in-out;
    }
    :host ::ng-deep .mermaid-content svg {
      max-width: 100%;
      height: auto;
    }
  `]
})
export class MermaidCanvasComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() diagramData: string = '';
  @ViewChild('mermaidDiv', { static: false }) mermaidDiv!: ElementRef;
  
  private initialized = false;
  private currentZoom = 1.0;
  
  get zoomLevel(): number {
    return this.currentZoom;
  }

  ngOnInit(): void {
    // Initialize Mermaid with configuration
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      themeVariables: {
        // Node styling — clean white boxes with subtle gray borders
        primaryColor: '#FFFFFF',
        primaryBorderColor: '#D0D5DD',
        primaryTextColor: '#344054',
        // Secondary / tertiary
        secondaryColor: '#F8F9FC',
        secondaryBorderColor: '#D0D5DD',
        secondaryTextColor: '#344054',
        tertiaryColor: '#FFFFFF',
        tertiaryBorderColor: '#D0D5DD',
        tertiaryTextColor: '#344054',
        // Lines and arrows
        lineColor: '#98A2B3',
        // Text
        textColor: '#344054',
        // Fonts
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        // Notes
        noteBkgColor: '#F8F9FC',
        noteBorderColor: '#D0D5DD',
        noteTextColor: '#344054',
        // Actors (sequence diagrams)
        actorBkg: '#FFFFFF',
        actorBorder: '#D0D5DD',
        actorTextColor: '#344054',
        actorLineColor: '#98A2B3',
        // Signals (sequence diagram arrows)
        signalColor: '#344054',
        signalTextColor: '#344054',
        // Labels
        labelBoxBkgColor: '#FFFFFF',
        labelBoxBorderColor: '#D0D5DD',
        labelTextColor: '#344054',
        // Loop box (sequence diagrams)
        loopTextColor: '#667085',
        // Activation
        activationBkgColor: '#F2F4F7',
        activationBorderColor: '#D0D5DD',
        // Cluster / subgraph
        clusterBkg: '#F8F9FC',
        clusterBorder: '#D0D5DD',
        // ER diagram
        entityBorderColor: '#D0D5DD',
        entityFillColor: '#FFFFFF',
        entityTextColor: '#344054',
        relationColor: '#98A2B3',
        attributeBackgroundColorEven: '#F8F9FC',
        attributeBackgroundColorOdd: '#FFFFFF',
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 60,
        width: 160,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 40,
        mirrorActors: false,
      },
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        padding: 20,
        nodeSpacing: 50,
        rankSpacing: 60,
      }
    });
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.diagramData) {
      this.renderDiagram();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['diagramData'] && !changes['diagramData'].firstChange && this.initialized) {
      this.renderDiagram();
    }
  }

  private async renderDiagram(): Promise<void> {
    if (!this.mermaidDiv || !this.diagramData) {
      return;
    }

    try {
      // Clear previous content
      this.mermaidDiv.nativeElement.innerHTML = '';
      
      // Generate unique ID for this diagram
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Render the diagram
      const { svg } = await mermaid.render(id, this.diagramData);
      
      // Insert the rendered SVG
      this.mermaidDiv.nativeElement.innerHTML = svg;
    } catch (error) {
      console.error('Error rendering Mermaid diagram:', error);
      this.mermaidDiv.nativeElement.innerHTML = `
        <div class="text-red-500 p-4 border border-red-300 rounded bg-red-50">
          <p class="font-semibold">Error rendering diagram</p>
          <p class="text-sm mt-2">${error}</p>
        </div>
      `;
    }
  }

  /**
   * Public method: Zoom in
   */
  public zoomIn(): void {
    this.currentZoom = Math.min(this.currentZoom + 0.2, 3.0);
  }

  /**
   * Public method: Zoom out
   */
  public zoomOut(): void {
    this.currentZoom = Math.max(this.currentZoom - 0.2, 0.5);
  }

  /**
   * Public method: Reset zoom to 100%
   */
  public resetZoom(): void {
    this.currentZoom = 1.0;
  }

  /**
   * Public method: Download diagram as SVG
   */
  public downloadAsSVG(): void {
    if (!this.mermaidDiv) return;

    try {
      const svgElement = this.mermaidDiv.nativeElement.querySelector('svg');
      if (svgElement) {
        // Clone and serialize the SVG
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        const link = document.createElement('a');
        link.download = `mermaid-diagram-${Date.now()}.svg`;
        link.href = svgUrl;
        link.click();
        URL.revokeObjectURL(svgUrl);
      }
    } catch (err) {
      console.error('Error downloading diagram:', err);
      alert('Download feature is in development.');
    }
  }
}
