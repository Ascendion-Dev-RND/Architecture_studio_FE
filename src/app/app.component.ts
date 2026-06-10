import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root Application Component
 * 
 * This is the main application component that serves as the container for all routes.
 * It provides the router outlet where routed components will be rendered.
 * 
 * Using standalone component pattern following Angular best practices.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: []
})
export class AppComponent {
  title = 'architecture-studio-angular';
}
