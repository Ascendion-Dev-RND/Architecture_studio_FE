import { Component, OnInit, HostListener } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Project, TabType } from '../../models/project.model';
import { ProjectService, Project as ApiProject } from '../../services/project.service';

/**
 * ProjectsSection Component
 * 
 * Displays a tabbed list of architecture projects from API.
 * Features two views:
 * - Recent: Shows the 3 most recent projects
 * - All: Shows all projects
 * 
 * Each project card displays:
 * - Project name
 * - Relative date
 * - "New" badge for recent items
 */
@Component({
  selector: 'app-projects-section',
  standalone: true,
  imports: [NgClass, NgFor, NgIf, LucideAngularModule],
  templateUrl: './projects-section.component.html',
  styleUrls: ['./projects-section.component.css']
})
export class ProjectsSectionComponent implements OnInit {
  activeTab: TabType = 'recent';
  projects: Project[] = [];
  isLoading = true;
  activeMenuProjectId: string | null = null;

  constructor(
    private projectService: ProjectService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  private loadProjects(): void {
    this.projectService.listProjects('active').subscribe({
      next: (apiProjects) => {
        this.projects = apiProjects.map(p => this.mapApiProject(p));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load projects:', err);
        this.isLoading = false;
        // Fall back to empty list
        this.projects = [];
      }
    });
  }

  private mapApiProject(apiProject: ApiProject): Project {
    const createdDate = new Date(apiProject.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    let dateStr = '';
    if (diffDays === 0) dateStr = 'Today';
    else if (diffDays === 1) dateStr = '1 day ago';
    else if (diffDays < 7) dateStr = `${diffDays} days ago`;
    else if (diffDays < 14) dateStr = '1 week ago';
    else if (diffDays < 30) dateStr = `${Math.floor(diffDays / 7)} weeks ago`;
    else dateStr = `${Math.floor(diffDays / 30)} months ago`;

    return {
      id: apiProject.id,
      name: apiProject.name,
      author: 'User',
      date: dateStr,
      isNew: diffDays <= 7
    };
  }

  /**
   * Returns the appropriate projects array based on active tab
   */
  get displayedProjects(): Project[] {
    if (this.activeTab === 'recent') {
      return this.projects.slice(0, 3);
    }
    return this.projects;
  }

  /**
   * Close dropdown menu when clicking outside
   */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMenuProjectId = null;
  }

  /**
   * Open project - navigate to workspace
   */
  openProject(project: Project): void {
    this.router.navigate(['/architecture-workspace'], {
      queryParams: { projectId: project.id }
    });
  }

  /**
   * Toggle three-dots menu
   */
  toggleMenu(project: Project, event: Event): void {
    event.stopPropagation();
    this.activeMenuProjectId = this.activeMenuProjectId === project.id ? null : project.id;
  }

  /**
   * Rename project
   */
  renameProject(project: Project): void {
    this.activeMenuProjectId = null;
    const newName = prompt('Enter new project name:', project.name);
    if (newName && newName.trim() && newName !== project.name) {
      this.projectService.updateProject(project.id, { name: newName.trim() }).subscribe({
        next: (updated) => {
          const index = this.projects.findIndex(p => p.id === project.id);
          if (index >= 0) {
            this.projects[index].name = updated.name;
          }
        },
        error: (err) => {
          console.error('Failed to rename project:', err);
          alert('Failed to rename project. Please try again.');
        }
      });
    }
  }

  /**
   * Delete project with confirmation
   */
  deleteProject(project: Project): void {
    this.activeMenuProjectId = null;
    const confirmed = confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`);
    if (confirmed) {
      this.projectService.deleteProject(project.id).subscribe({
        next: () => {
          this.projects = this.projects.filter(p => p.id !== project.id);
        },
        error: (err) => {
          console.error('Failed to delete project:', err);
          alert('Failed to delete project. Please try again.');
        }
      });
    }
  }
}
