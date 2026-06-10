import { Component } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/**
 * HeroSection Component
 * 
 * The main hero section displayed at the top of the landing page.
 * Creates visual impact with:
 * - Animated background decorations (blurred circles)
 * - Grid pattern overlay for texture
 * - Badge highlighting AI-powered features
 * - Main headline with gradient text effect
 * - Supporting tagline paragraph
 */
@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './hero-section.component.html',
  styleUrls: ['./hero-section.component.css']
})
export class HeroSectionComponent {}
