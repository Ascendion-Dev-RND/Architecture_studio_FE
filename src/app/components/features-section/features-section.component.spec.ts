import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeaturesSectionComponent } from './features-section.component';
import { FeatureCardComponent } from '../feature-card/feature-card.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('FeaturesSectionComponent', () => {
  let component: FeaturesSectionComponent;
  let fixture: ComponentFixture<FeaturesSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FeaturesSectionComponent,
        FeatureCardComponent,
        RouterTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeaturesSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render features section with gradient background', () => {
    const compiled = fixture.nativeElement;
    const section = compiled.querySelector('section#features');
    expect(section).toBeTruthy();
    expect(section.classList.contains('gradient-lavender')).toBe(true);
  });

  it('should render three feature cards', () => {
    const compiled = fixture.nativeElement;
    const featureCards = compiled.querySelectorAll('app-feature-card');
    expect(featureCards.length).toBe(3);
  });

  it('should have Architecture Generator card with correct properties', () => {
    const compiled = fixture.nativeElement;
    const generatorCard = compiled.querySelectorAll('app-feature-card')[0];
    expect(generatorCard.getAttribute('title')).toBe('Architecture');
    expect(generatorCard.getAttribute('subtitle')).toBe('Generator');
    expect(generatorCard.getAttribute('href')).toBe('/architecture-generator');
  });

  it('should have Architecture Assessment card with correct properties', () => {
    const compiled = fixture.nativeElement;
    const assessmentCard = compiled.querySelectorAll('app-feature-card')[1];
    expect(assessmentCard.getAttribute('title')).toBe('Architecture');
    expect(assessmentCard.getAttribute('subtitle')).toBe('Assessment');
    expect(assessmentCard.getAttribute('href')).toBe('/architecture-assessment');
  });

  it('should have E2E System Design card with correct properties', () => {
    const compiled = fixture.nativeElement;
    const e2eCard = compiled.querySelectorAll('app-feature-card')[2];
    expect(e2eCard.getAttribute('title')).toBe('E2E System');
    expect(e2eCard.getAttribute('subtitle')).toBe('Design');
    expect(e2eCard.getAttribute('href')).toBe('/e2e-system-design');
  });
});
