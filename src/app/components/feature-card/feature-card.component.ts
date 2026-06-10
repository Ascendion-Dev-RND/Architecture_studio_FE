import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common';
import { LucideAngularModule, Clock, Layers } from 'lucide-angular';

/**
 * FeatureCard Component
 * 
 * A reusable card component for displaying feature information.
 * Can be used as a static card or as a link to another page.
 * 
 * Features:
 * - Two-line title (title + subtitle)
 * - Tagline for brief description
 * - Icon with customizable background and color
 * - Full description text
 * - Optional link behavior
 * - Hover effects with enhanced shadow
 */
@Component({
  selector: 'app-feature-card',
  standalone: true,
  imports: [RouterLink, NgClass, NgIf, NgTemplateOutlet, LucideAngularModule],
  templateUrl: './feature-card.component.html',
  styleUrls: ['./feature-card.component.css']
})
export class FeatureCardComponent {
  @Input() title: string = '';
  @Input() subtitle?: string;
  @Input() tagline?: string;
  @Input() description: string = '';
  @Input() icon: string = 'Workflow';
  @Input() svgIcon?: string; // Path to SVG icon
  @Input() iconBgColor: string = 'bg-primary/10';
  @Input() iconColor: string = 'text-primary';
  @Input() className?: string;
  @Input() href?: string;

  get cardClasses(): string {
    return this.className || '';
  }
}
