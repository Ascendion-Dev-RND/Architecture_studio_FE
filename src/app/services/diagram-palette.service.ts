import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, firstValueFrom, forkJoin, map } from 'rxjs';

/**
 * Visual tokens for one container kind (CLOUD / VPC / SUBNET / ...). Mirrors
 * the MaxGraph CellStyle subset we need to round-trip from yaml/JSON onto
 * the renderer.
 */
export interface ContainerToken {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  fontColor: string;
  /** 1 = dashed border; absent / 0 = solid. */
  dashed?: number;
}

/**
 * One provider's palette + corner-style preference. Loaded from
 * {@code /assets/diagram-palettes/{id}.json}; matched against
 * {@code LayoutIR.provider} at render time.
 *
 * <p>Why JSON not TypeScript: adding a new cloud / fidelity tier is a
 * file drop + index entry, no recompile. Long-term plan is to have v2
 * echo the resolved {@link StyleProfileV2} tokens in the API response so
 * the FE doesn't need any palette at all — but until that lands, this
 * service is the configurability surface.
 */
export interface ProviderPalette {
  id: string;
  label: string;
  /**
   * Visual fidelity tier the palette targets. Mirrors v2's
   * {@code com.aas.diagramv2.intent.Fidelity}. Shipped JSONs are all
   * "reference" by default — that's the user-facing promise. Other
   * tiers (low / medium / high) would live in sibling files.
   */
  fidelity?: 'low' | 'medium' | 'high' | 'reference';
  /** "sharp" → no border radius (Microsoft Azure style); "rounded" → 8px arc. */
  cornerStyle: 'sharp' | 'rounded';
  containers: Record<string, ContainerToken>;
}

interface PaletteIndexEntry {
  id: string;
  file: string;
  /** Provider strings (case-insensitive) this palette applies to. */
  matches: string[];
}

interface PaletteIndex {
  default: string;
  providers: PaletteIndexEntry[];
}

@Injectable({ providedIn: 'root' })
export class DiagramPaletteService {

  private readonly ready$ = new ReplaySubject<void>(1);
  private byId = new Map<string, ProviderPalette>();
  private byProviderUpper = new Map<string, ProviderPalette>();
  private defaultId = 'aws';
  private loaded = false;

  constructor(private readonly http: HttpClient) {
    this.loadAll();
  }

  /**
   * Returns the palette that should be used for the given provider string
   * (case-insensitive). Falls back to the index's default. NEVER returns
   * undefined — components shouldn't have to defend against missing palettes.
   */
  paletteFor(provider: string | undefined | null): ProviderPalette {
    const key = (provider ?? '').toUpperCase();
    const hit = this.byProviderUpper.get(key);
    if (hit) return hit;
    const fallback = this.byId.get(this.defaultId);
    if (fallback) return fallback;
    // Emergency fallback if the index hasn't loaded yet — return a tiny
    // neutral palette so the canvas still renders something instead of
    // throwing. This is bridged out as soon as the JSON files resolve.
    return EMERGENCY_PALETTE;
  }

  /** Resolves once the asset bundle has loaded (or failed). */
  whenReady(): Observable<void> {
    return this.ready$.asObservable();
  }

  /** Convenience: blocking wait for tests / async loaders. */
  async waitForReady(): Promise<void> {
    if (this.loaded) return;
    await firstValueFrom(this.ready$);
  }

  // ------------------------------------------------------------------

  private loadAll(): void {
    this.http.get<PaletteIndex>('/assets/diagram-palettes/_index.json').subscribe({
      next: (idx) => {
        this.defaultId = idx.default ?? 'aws';
        const providers = idx.providers ?? [];
        if (providers.length === 0) {
          this.loaded = true;
          this.ready$.next();
          this.ready$.complete();
          return;
        }
        const requests: Observable<{ entry: PaletteIndexEntry; palette: ProviderPalette }>[] =
          providers.map(p =>
            this.http.get<ProviderPalette>(`/assets/diagram-palettes/${p.file}`).pipe(
              map(palette => ({ entry: p, palette })),
            ));
        forkJoin(requests).subscribe({
          next: (results) => {
            for (const r of results) {
              this.byId.set(r.palette.id, r.palette);
              for (const match of r.entry.matches) {
                this.byProviderUpper.set(match.toUpperCase(), r.palette);
              }
            }
            this.loaded = true;
            this.ready$.next();
            this.ready$.complete();
          },
          error: (err) => {
            console.warn('DiagramPaletteService: failed to load palette file', err);
            this.loaded = true;
            this.ready$.next();
            this.ready$.complete();
          },
        });
      },
      error: (err) => {
        console.warn('DiagramPaletteService: failed to load _index.json — using emergency palette', err);
        this.loaded = true;
        this.ready$.next();
        this.ready$.complete();
      },
    });
  }
}

const EMERGENCY_PALETTE: ProviderPalette = {
  id: 'emergency',
  label: 'Emergency fallback',
  // Sharp by default — reference-grade cloud diagrams (and the user's target
  // Azure/AWS reference imagery) use square corners; this also guarantees no
  // rounded containers even when the palette JSONs haven't finished loading.
  cornerStyle: 'sharp',
  containers: {
    DEFAULT: { fillColor: '#F8FAFC', strokeColor: '#94A3B8', strokeWidth: 1, fontColor: '#475569' },
  },
};
