import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Display payload returned to the chat / banner UI when the user (or the agent)
 * references one of the seven retired view types (LLD §11.4 + PR4 cutover).
 */
export interface UnsupportedViewTypeMessage {
  /** Title displayed in the chat reply card. */
  title: string;
  /** Body shown below the title. */
  body: string;
  /** Suggested replacement view types the user can pick from. */
  suggestedAlternatives: SuggestedAlternative[];
  /** The original viewType the agent / user referenced. */
  rejectedViewType: string;
}

export interface SuggestedAlternative {
  value: string;
  label: string;
  rationale: string;
}

/**
 * One catalog entry — mirrors the YAML at
 * `agents/src/data/unsupported_view_types.yaml` (loaded by the agent) and
 * `architecture-service/src/main/resources/intake/unsupported_view_types.yaml`
 * (served by the BFF on HTTP 410 errors).
 */
interface UnsupportedViewTypeEntry {
  retiredLabel: string;
  reason: string;
  alternatives: SuggestedAlternative[];
}

/**
 * UnsupportedViewTypeHandlerService
 *
 * Single source of truth (FE side) for what the user sees when:
 *   - The agent attempts to extract a retired view type.
 *   - The user pastes a prompt explicitly asking for one.
 *   - The BFF returns HTTP 410 with `errorCode = "UNSUPPORTED_VIEW_TYPE"`.
 *
 * The catalog is kept inline so the FE can render the chat reply without a
 * round-trip; the same data is duplicated in the BFF YAML so server-side
 * validation can attach matching context to the 410 payload.
 */
@Injectable({ providedIn: 'root' })
export class UnsupportedViewTypeHandlerService {

  private readonly catalog: Record<string, UnsupportedViewTypeEntry> = {
    'enterprise-context': {
      retiredLabel: 'Enterprise Context / Landscape',
      reason: 'Enterprise-context views were retired because the agent could '
            + 'not produce diagrams that were structurally distinct from a '
            + 'C4 Context view. Use C4 Context for the same intent.',
      alternatives: [
        {
          value: 'c4-context',
          label: 'C4 Context Diagram',
          rationale: 'Captures the same actor / external-system landscape with a stricter contract.'
        },
        {
          value: 'deployment-infrastructure',
          label: 'Deployment / Infrastructure',
          rationale: 'Use this when the user actually meant the runtime topology, not the business landscape.'
        }
      ]
    },
    'capability-map': {
      retiredLabel: 'Capability Map',
      reason: 'Capability maps are a business artefact and not part of the v2 '
            + 'compile pipeline.',
      alternatives: [
        {
          value: 'c4-context',
          label: 'C4 Context Diagram',
          rationale: 'For showing what the system does at a high level, prefer a C4 Context view.'
        }
      ]
    },
    'bpmn': {
      retiredLabel: 'Value Stream / BPMN Process',
      reason: 'BPMN process diagrams require a specialised swim-lane / gateway '
            + 'compiler that v2 does not ship.',
      alternatives: [
        {
          value: 'cicd-pipeline',
          label: 'CI/CD Pipeline',
          rationale: 'For build / deploy automation flows, use the CI/CD pipeline view.'
        },
        {
          value: 'c4-component',
          label: 'C4 Component Diagram',
          rationale: 'For runtime collaboration inside a single container, use the component view.'
        }
      ]
    },
    'application-landscape': {
      retiredLabel: 'Application Landscape',
      reason: 'Application landscape views overlap heavily with C4 Container, '
            + 'and v2 does not maintain a separate compiler for it.',
      alternatives: [
        {
          value: 'c4-container',
          label: 'C4 Container Diagram',
          rationale: 'Captures the same per-application boundaries with explicit technologies.'
        }
      ]
    },
    'data-information': {
      retiredLabel: 'Data / Information View',
      reason: 'ER / data-model diagrams require a dedicated layout engine that '
            + 'v2 does not ship; the agent may produce a deployment view '
            + 'showing the database tier instead.',
      alternatives: [
        {
          value: 'c4-container',
          label: 'C4 Container Diagram',
          rationale: 'Use to show database containers and their dependencies.'
        },
        {
          value: 'deployment-infrastructure',
          label: 'Deployment / Infrastructure',
          rationale: 'Use to place data tier nodes inside subnet / VPC / region boundaries.'
        }
      ]
    },
    'component-integration': {
      retiredLabel: 'Component / Integration View',
      reason: 'Component-integration diagrams have been folded into C4 '
            + 'Component (intra-container) or Deployment (inter-system).',
      alternatives: [
        {
          value: 'c4-component',
          label: 'C4 Component Diagram',
          rationale: 'For internal API / adapter wiring inside a single container.'
        },
        {
          value: 'deployment-infrastructure',
          label: 'Deployment / Infrastructure',
          rationale: 'For wiring across systems / VPCs / regions.'
        }
      ]
    },
    'sequence': {
      retiredLabel: 'Runtime Sequence / Event Flow',
      reason: 'Sequence diagrams are best authored in a notation editor; '
            + 'v2 does not maintain a sequence-diagram compiler.',
      alternatives: [
        {
          value: 'c4-component',
          label: 'C4 Component Diagram',
          rationale: 'For static structural collaboration, use C4 Component.'
        }
      ]
    },
    'transition-roadmap': {
      retiredLabel: 'Transition Roadmap',
      reason: 'Transition roadmaps require a dedicated timeline / Gantt '
            + 'compiler that v2 does not ship.',
      alternatives: [
        {
          value: 'deployment-infrastructure',
          label: 'Deployment / Infrastructure',
          rationale: 'For migration target topology, use Deployment / Infrastructure.'
        }
      ]
    }
  };

  /** Returns true when the supplied viewType is one of the retired seven. */
  isUnsupported(viewType: string | null | undefined): boolean {
    if (!viewType) return false;
    return Object.prototype.hasOwnProperty.call(this.catalog, viewType);
  }

  /**
   * Build the chat-reply payload for a retired viewType. Returns `null` for
   * unknown / supported viewTypes — callers should treat that as "not our
   * concern" and let the normal error handler take over.
   */
  buildMessage(viewType: string | null | undefined): UnsupportedViewTypeMessage | null {
    if (!viewType) return null;
    const entry = this.catalog[viewType];
    if (!entry) return null;
    return {
      title: `“${entry.retiredLabel}” is no longer supported`,
      body: entry.reason,
      suggestedAlternatives: entry.alternatives.map(a => ({ ...a })),
      rejectedViewType: viewType
    };
  }

  /**
   * Translate an HTTP 410 error from the BFF compose endpoint into a UI
   * message. Falls back to a generic "no longer supported" message if the
   * server did not include a `viewType` field.
   */
  fromHttp410(error: HttpErrorResponse): UnsupportedViewTypeMessage | null {
    if (!error || error.status !== 410) return null;
    const viewType = (error.error && (error.error.viewType || error.error.requestedViewType)) || '';
    const msg = this.buildMessage(viewType);
    if (msg) return msg;
    return {
      title: 'This diagram type is no longer supported',
      body: error.error?.message
        || 'The agent attempted to produce a view type that v2 no longer compiles. Please pick one of the supported types and try again.',
      suggestedAlternatives: [
        {
          value: 'c4-context',
          label: 'C4 Context Diagram',
          rationale: 'Default fallback when intent is unclear.'
        }
      ],
      rejectedViewType: viewType || 'unknown'
    };
  }

  /** All retired viewType ids — useful for FE banners or admin tooling. */
  retiredViewTypes(): string[] {
    return Object.keys(this.catalog);
  }
}
