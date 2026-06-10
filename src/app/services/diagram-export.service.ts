import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Supported client-side export formats (LLD §13.5 + PR5).
 *
 * Server-side rendering (PNG with golden fonts) is NOT in scope for PR5;
 * `drawio` / `json` are pulled from the BFF export endpoint added in PR10.
 */
export type DiagramExportFormat = 'svg' | 'png' | 'drawio' | 'json';

export interface DiagramExportOptions {
  /** Pixel scale for PNG. Defaults to 2 for retina-quality output. */
  pixelRatio?: number;
  /** Base name (without extension). Defaults to `diagram`. */
  fileName?: string;
  /** Background fill for PNG. Defaults to white. */
  background?: string;
}

/**
 * DiagramExportService
 *
 * Centralised export façade for the workspace toolbar (LLD §13.5):
 *
 * - **svg**     Serialises the live SVG node from the maxGraph canvas
 *               and triggers a download.
 * - **png**     Same SVG node rasterised to a canvas (uses
 *               `html-to-image` when available; falls back to manual
 *               XMLSerializer + Image on older browsers).
 * - **drawio**  Calls the BFF export endpoint
 *               `GET /api/architecture/diagrams/{id}/export?format=drawio`
 *               (added in PR10) and triggers a download.
 * - **json**    Same endpoint with `format=json`.
 *
 * The service is *not* responsible for server-side PNG rendering — that
 * is explicitly out of scope per the user's "not-in-scope" list.
 */
@Injectable({ providedIn: 'root' })
export class DiagramExportService {

  private readonly bffBase = (environment.api?.backendUrl || '').replace(/\/$/, '');

  constructor(private readonly http: HttpClient) {}

  /** Top-level entry — picks the right strategy by format. */
  async export(
    format: DiagramExportFormat,
    svgElement: SVGElement | null,
    diagramId: string | null,
    options: DiagramExportOptions = {}
  ): Promise<void> {
    const fileName = options.fileName?.trim() || `diagram-${Date.now()}`;

    switch (format) {
      case 'svg':
        if (!svgElement) throw new Error('SVG element required for SVG export');
        return this.exportSvg(svgElement, fileName);
      case 'png':
        if (!svgElement) throw new Error('SVG element required for PNG export');
        return this.exportPng(svgElement, fileName, options);
      case 'drawio':
        if (!diagramId) throw new Error('diagramId required for drawio export');
        return this.exportFromBff(diagramId, 'drawio', fileName);
      case 'json':
        if (!diagramId) throw new Error('diagramId required for json export');
        return this.exportFromBff(diagramId, 'json', fileName);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Client-side: SVG
  // ─────────────────────────────────────────────────────────────────

  private exportSvg(svgElement: SVGElement, fileName: string): void {
    const clone = this.cloneAndSize(svgElement);
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    this.triggerDownload(blob, `${fileName}.svg`);
  }

  // ─────────────────────────────────────────────────────────────────
  // Client-side: PNG
  // ─────────────────────────────────────────────────────────────────

  private async exportPng(
    svgElement: SVGElement,
    fileName: string,
    options: DiagramExportOptions
  ): Promise<void> {
    const pixelRatio = Math.max(1, options.pixelRatio ?? 2);
    const background = options.background ?? '#ffffff';

    // Try html-to-image first — gives crisper text and inlines fonts.
    const lib = await this.loadHtmlToImage();
    if (lib) {
      try {
        const dataUrl = await lib.toPng(svgElement as unknown as HTMLElement, {
          pixelRatio,
          backgroundColor: background,
          cacheBust: true,
          // html-to-image otherwise embeds external images via <foreignObject>
          // which Edge / Safari refuse to draw onto a canvas.
          skipFonts: false
        });
        const blob = await this.dataUrlToBlob(dataUrl);
        this.triggerDownload(blob, `${fileName}.png`);
        return;
      } catch (err) {
        console.warn('[DiagramExportService] html-to-image failed, falling back to manual rasteriser', err);
      }
    }

    // Manual fallback — works everywhere but ignores external fonts.
    const clone = this.cloneAndSize(svgElement);
    const width = parseFloat(clone.getAttribute('width') || '800');
    const height = parseFloat(clone.getAttribute('height') || '600');
    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width * pixelRatio;
          canvas.height = height * pixelRatio;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context unavailable'));
            return;
          }
          ctx.scale(pixelRatio, pixelRatio);
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas.toBlob returned null')), 'image/png');
        };
        img.onerror = () => reject(new Error('Failed to rasterise SVG'));
        img.src = svgUrl;
      });
      this.triggerDownload(blob, `${fileName}.png`);
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Server-side fetch: drawio / json
  // ─────────────────────────────────────────────────────────────────

  private async exportFromBff(
    diagramId: string,
    format: 'drawio' | 'json',
    fileName: string
  ): Promise<void> {
    const url = `${this.bffBase}/api/architecture/diagrams/${encodeURIComponent(diagramId)}/export?format=${format}`;
    const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
    if (!blob) throw new Error('Empty response from export endpoint');
    const ext = format === 'drawio' ? 'drawio' : 'json';
    this.triggerDownload(blob, `${fileName}.${ext}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  /** Deep-clone the SVG and stamp width/height matching its bounding box. */
  private cloneAndSize(svg: SVGElement): SVGElement {
    const clone = svg.cloneNode(true) as SVGElement;
    const bbox = (svg as SVGGraphicsElement).getBBox?.();
    const padding = 40;
    let width = parseFloat(svg.getAttribute('width') || '0');
    let height = parseFloat(svg.getAttribute('height') || '0');
    if ((!width || !height) && bbox) {
      width = bbox.width + padding;
      height = bbox.height + padding;
    }
    if (!width) width = 800;
    if (!height) height = 600;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    return clone;
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  /**
   * Lazily import html-to-image to avoid a hard dependency in environments
   * where it is not yet installed. When the package is missing we silently
   * return `null` and the caller falls back to the manual rasteriser.
   */
  private async loadHtmlToImage(): Promise<{ toPng: (n: HTMLElement, opts: any) => Promise<string> } | null> {
    try {
      // The dynamic import string is intentionally non-string-literal to
      // prevent the Angular build from failing when the package is absent.
      const mod = await import(/* webpackIgnore: true */ 'html-to-image' as any);
      return mod && typeof mod.toPng === 'function' ? mod : null;
    } catch {
      return null;
    }
  }
}
