import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroSectionComponent } from './hero-section.component';
import { LucideAngularModule } from 'lucide-angular';

describe('HeroSectionComponent', () => {
  let component: HeroSectionComponent;
  let fixture: ComponentFixture<HeroSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroSectionComponent, LucideAngularModule]
    }).compileComponents();

    fixture = TestBed.createComponent(HeroSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the main headline', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const headline = compiled.querySelector('h1');
    expect(headline?.textContent).toContain('Design Systems');
    expect(headline?.textContent).toContain('with Intelligence');
  });

  it('should display the AI-powered badge', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('.inline-flex span');
    expect(badge?.textContent).toContain('AI-Powered Architecture Studio');
  });

  it('should display the supporting tagline', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const tagline = compiled.querySelector('p');
    expect(tagline?.textContent).toContain('Explore, design, and validate');
  });

  it('should have decorative background elements', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const decorations = compiled.querySelectorAll('.absolute.rounded-full');
    expect(decorations.length).toBeGreaterThanOrEqual(2);
  });
});
