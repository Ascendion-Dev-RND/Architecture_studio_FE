import { Component } from '@angular/core';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { HeroSectionComponent } from '../../components/hero-section/hero-section.component';
import { FeaturesSectionComponent } from '../../components/features-section/features-section.component';
import { ProjectsSectionComponent } from '../../components/projects-section/projects-section.component';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

/**
 * Home Component (Landing Page)
 * 
 * The main landing page for Architecture-Studio. This page serves as the
 * entry point for users and showcases the platform's core capabilities.
 * 
 * Page Structure:
 * 1. Navbar - Fixed top navigation with brand logo
 * 2. HeroSection - Main headline, tagline, and value proposition
 * 3. FeaturesSection - Three core feature cards (Generator, Assessment, E2E Design)
 * 4. ProjectsSection - Recent and all projects listing
 * 
 * Route: "/"
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NavbarComponent,
    HeroSectionComponent,
    FeaturesSectionComponent,
    ProjectsSectionComponent,
    BreadcrumbComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Home' }
  ];
}
