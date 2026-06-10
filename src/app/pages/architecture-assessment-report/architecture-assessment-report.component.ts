import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

/**
 * ArchitectureAssessmentReport Component
 * 
 * Displays a comprehensive architecture assessment report with 15 sections:
 * 1. Executive Summary - Purpose, key findings, recommendations
 * 2. Assessment Scope - Domains and artifacts reviewed
 * 3. Business & System Context - Capabilities, stakeholders, overview
 * 4. NFR Assessment & Scorecard - 8 NFR ratings
 * 5. TOGAF Alignment Review - ADM phases, viewpoints, principles, ABB/SBB
 * 6. Design Patterns & Anti-Patterns - Identified, recommended, anti-patterns
 * 7. Domain-Driven Design Review - Decomposition, bounded contexts, context map
 * 8. Security, Compliance & Governance - Security, compliance, maturity
 * 9. Infrastructure & Operations - Cloud architecture, observability
 * 10. Data & Integration Architecture - Data flows, issues, integration
 * 11. Detailed Gap Analysis - 5 prioritized gaps
 * 12. TO-BE Architecture - Characteristics, patterns, tech stack, diagram
 * 13. Roadmap - Immediate, mid-term, long-term phases
 * 14. ADRs - Sample architecture decision record
 * 15. Final Scorecard - Weighted scores with overall maturity level
 */
@Component({
  selector: 'app-architecture-assessment-report',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './architecture-assessment-report.component.html',
  styleUrls: ['./architecture-assessment-report.component.css']
})
export class ArchitectureAssessmentReportComponent implements OnInit {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Architecture Assessment', link: '/architecture-assessment' },
    { label: 'Report' }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {}
}
