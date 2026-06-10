import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectsSectionComponent } from './projects-section.component';
import { LucideAngularModule } from 'lucide-angular';

describe('ProjectsSectionComponent', () => {
  let component: ProjectsSectionComponent;
  let fixture: ComponentFixture<ProjectsSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsSectionComponent, LucideAngularModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default activeTab as recent', () => {
    expect(component.activeTab).toBe('recent');
  });

  it('should display recent projects by default', () => {
    const projects = component.displayedProjects;
    expect(projects.length).toBe(3);
  });

  it('should switch to all projects tab', () => {
    component.activeTab = 'all';
    const projects = component.displayedProjects;
    expect(projects.length).toBe(5);
  });

  it('should render tab navigation', () => {
    const compiled = fixture.nativeElement;
    const tabs = compiled.querySelectorAll('button');
    expect(tabs.length).toBe(2);
  });

  it('should render Recent tab button', () => {
    const compiled = fixture.nativeElement;
    const recentTab = compiled.querySelectorAll('button')[0];
    expect(recentTab.textContent).toContain('Recent');
  });

  it('should render All projects tab button', () => {
    const compiled = fixture.nativeElement;
    const allTab = compiled.querySelectorAll('button')[1];
    expect(allTab.textContent).toContain('All projects');
  });

  it('should render project cards', () => {
    const compiled = fixture.nativeElement;
    const projectCards = compiled.querySelectorAll('.bg-card.rounded-xl');
    expect(projectCards.length).toBe(3); // 3 recent projects by default
  });

  it('should display new badge for recent projects', () => {
    const compiled = fixture.nativeElement;
    const newBadges = compiled.querySelectorAll('span.bg-primary\\/10');
    expect(newBadges.length).toBeGreaterThan(0);
  });

  it('should change displayed projects when tab is clicked', () => {
    component.activeTab = 'all';
    fixture.detectChanges();
    const projects = component.displayedProjects;
    expect(projects.length).toBe(5);
  });
});
