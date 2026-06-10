import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

interface InputMethod {
  id: 'upload' | 'paste' | 'import';
  icon: string;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-modernization-discovery',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './modernization-discovery.component.html',
  styleUrls: ['./modernization-discovery.component.css']
})
export class ModernizationDiscoveryComponent {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Modernization Studio', link: '/modernization' },
    { label: 'Discovery' }
  ];

  systemDescription: string = '';
  uploadedFiles: File[] = [];
  
  // Target-state preferences
  selectedCloudModel: string = 'AWS';
  selectedTimeline: string = '6 months';
  selectedOutcomes: string[] = [];
  
  cloudModels = ['AWS', 'Azure', 'GCP', 'On-Prem', 'Hybrid'];
  timelines = ['3 months', '6 months', '12 months', '18+ months'];
  outcomes = [
    { id: 'reduce-cost', label: 'Reduce Cost', icon: 'TrendingDown' },
    { id: 'delivery-speed', label: 'Delivery Speed', icon: 'Zap' },
    { id: 'reliability', label: 'Reliability', icon: 'Shield' },
    { id: 'scalability', label: 'Scalability', icon: 'Maximize2' },
    { id: 'compliance', label: 'Compliance', icon: 'CheckCircle' }
  ];
  
  constructor(private router: Router) {}

  toggleOutcome(outcomeId: string): void {
    const index = this.selectedOutcomes.indexOf(outcomeId);
    if (index > -1) {
      this.selectedOutcomes.splice(index, 1);
    } else {
      this.selectedOutcomes.push(outcomeId);
    }
  }

  isOutcomeSelected(outcomeId: string): boolean {
    return this.selectedOutcomes.includes(outcomeId);
  }

  getOutcomeLabel(outcomeId: string): string {
    const outcome = this.outcomes.find(o => o.id === outcomeId);
    return outcome ? outcome.label : '';
  }

  handleFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.uploadedFiles = Array.from(input.files);
    }
  }

  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
  }

  canAnalyze(): boolean {
    const hasContent = this.systemDescription.trim().length > 20 || this.uploadedFiles.length > 0;
    return hasContent && this.selectedCloudModel !== '' && this.selectedTimeline !== '';
  }

  analyzeCurrentState(): void {
    if (this.canAnalyze()) {
      // TODO: Call backend API for analysis
      console.log('Analyzing current state:', {
        systemDescription: this.systemDescription,
        files: this.uploadedFiles,
        cloudModel: this.selectedCloudModel,
        timeline: this.selectedTimeline,
        outcomes: this.selectedOutcomes
      });

      // Navigate to modernization options page with analysis data
      this.router.navigate(['/modernization/options'], {
        state: {
          systemDescription: this.systemDescription,
          cloudModel: this.selectedCloudModel,
          timeline: this.selectedTimeline,
          outcomes: this.selectedOutcomes
        }
      });
    }
  }
}
