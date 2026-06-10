import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeComponent } from './home.component';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { HeroSectionComponent } from '../../components/hero-section/hero-section.component';
import { FeaturesSectionComponent } from '../../components/features-section/features-section.component';
import { ProjectsSectionComponent } from '../../components/projects-section/projects-section.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HomeComponent,
        NavbarComponent,
        HeroSectionComponent,
        FeaturesSectionComponent,
        ProjectsSectionComponent,
        RouterTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render navbar component', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const navbar = compiled.querySelector('app-navbar');
    expect(navbar).toBeTruthy();
  });

  it('should render hero section component', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const heroSection = compiled.querySelector('app-hero-section');
    expect(heroSection).toBeTruthy();
  });

  it('should render features section component', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const featuresSection = compiled.querySelector('app-features-section');
    expect(featuresSection).toBeTruthy();
  });

  it('should render projects section component', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const projectsSection = compiled.querySelector('app-projects-section');
    expect(projectsSection).toBeTruthy();
  });

  it('should have main element', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const main = compiled.querySelector('main');
    expect(main).toBeTruthy();
  });

  it('should have correct structure with all sections', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    // Check all major sections are present
    expect(compiled.querySelector('app-navbar')).toBeTruthy();
    expect(compiled.querySelector('app-hero-section')).toBeTruthy();
    expect(compiled.querySelector('app-features-section')).toBeTruthy();
    expect(compiled.querySelector('app-projects-section')).toBeTruthy();
  });
});
