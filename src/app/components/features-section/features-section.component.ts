import { Component } from '@angular/core';
import { FeatureCardComponent } from '../feature-card/feature-card.component';

/**
 * FeaturesSection Component
 * 
 * Displays the three core feature cards of Architecture-Studio:
 * 1. Architecture Generator - Creates architectures from ideas
 * 2. Architecture Assessment - Validates and reviews architectures
 * 3. E2E System Design - Complete end-to-end system solutions
 * 
 * Layout:
 * - Single row on desktop (3 columns)
 * - Stacked on mobile (1 column)
 * - Uses gradient-lavender background
 */
@Component({
  selector: 'app-features-section',
  standalone: true,
  imports: [FeatureCardComponent],
  templateUrl: './features-section.component.html',
  styleUrls: ['./features-section.component.css']
})
export class FeaturesSectionComponent {}
