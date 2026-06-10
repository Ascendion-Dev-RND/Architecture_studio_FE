import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Navbar Component
 * 
 * A fixed top navigation bar that appears across the application.
 * Features a glassmorphism effect with backdrop blur.
 * 
 * Design Features:
 * - Fixed positioning with z-index for overlay behavior
 * - Semi-transparent background with backdrop blur
 * - Subtle bottom border for definition
 * - Brand name with gradient text effect (coral to coral-light)
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {}
