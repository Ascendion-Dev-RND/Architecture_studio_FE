import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgFor } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

/**
 * AssessmentOptions Component
 * 
 * Options selection page for architecture assessment.
 */
@Component({
  selector: 'app-assessment-options',
  standalone: true,
  imports: [RouterLink, FormsModule, NgFor, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './assessment-options.component.html',
  styleUrls: ['./assessment-options.component.css']
})
export class AssessmentOptionsComponent {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Architecture Assessment', link: '/architecture-assessment' },
    { label: 'Options' }
  ];

  assessmentDepth: string = 'standard';
  
  assessmentCriteria = [
    { name: 'TOGAF Compliance', description: 'Check against TOGAF framework', selected: true },
    { name: 'Security & Risk', description: 'Security vulnerabilities and risks', selected: true },
    { name: 'Performance & Scalability', description: 'System performance analysis', selected: true },
    { name: 'Best Practices', description: 'Industry best practices', selected: true },
    { name: 'Cost Optimization', description: 'Resource and cost efficiency', selected: false },
    { name: 'Maintainability', description: 'Code and system maintainability', selected: false }
  ];

  constructor(private router: Router) {}

  startAssessment(): void {
    const selectedCriteria = this.assessmentCriteria
      .filter(c => c.selected)
      .map(c => c.name);
    
    if (selectedCriteria.length === 0) {
      alert('Please select at least one assessment criterion');
      return;
    }

    this.router.navigate(['/architecture-assessment-report'], {
      state: { 
        criteria: selectedCriteria,
        depth: this.assessmentDepth
      }
    });
  }
}
