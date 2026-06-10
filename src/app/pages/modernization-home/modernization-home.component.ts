import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-modernization-home',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './modernization-home.component.html',
  styleUrls: ['./modernization-home.component.css']
})
export class ModernizationHomeComponent {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Modernization Studio' }
  ];

  constructor(private router: Router) {}

  navigateToDiscovery(): void {
    this.router.navigate(['/modernization/discovery']);
  }

  navigateToArtifactHub(): void {
    // TODO: Implement Artifact Hub navigation
    console.log('Artifact Hub - Coming soon');
  }
}
