import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FeatureCardComponent } from './feature-card.component';
import { LucideAngularModule } from 'lucide-angular';

describe('FeatureCardComponent', () => {
  let component: FeatureCardComponent;
  let fixture: ComponentFixture<FeatureCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureCardComponent, RouterTestingModule, LucideAngularModule]
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display title', () => {
    component.title = 'Test Title';
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const titleElement = compiled.querySelector('h3');
    expect(titleElement?.textContent).toContain('Test Title');
  });

  it('should display subtitle when provided', () => {
    component.title = 'Main Title';
    component.subtitle = 'Sub Title';
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const titleElement = compiled.querySelector('h3');
    expect(titleElement?.textContent).toContain('Sub Title');
  });

  it('should display tagline when provided', () => {
    component.tagline = 'Test Tagline';
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const taglineElement = compiled.querySelector('.text-primary');
    expect(taglineElement?.textContent).toContain('Test Tagline');
  });

  it('should display description', () => {
    component.description = 'Test Description';
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const descElement = compiled.querySelector('.text-muted-foreground');
    expect(descElement?.textContent).toContain('Test Description');
  });

  it('should render as link when href is provided', () => {
    component.href = '/test-route';
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const linkElement = compiled.querySelector('a[routerLink]');
    expect(linkElement).toBeTruthy();
  });

  it('should render as div when href is not provided', () => {
    component.href = undefined;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const divElement = compiled.querySelector('.bg-card.rounded-2xl');
    expect(divElement).toBeTruthy();
  });

  it('should apply custom class name', () => {
    component.className = 'custom-class';
    fixture.detectChanges();
    expect(component.cardClasses).toBe('custom-class');
  });
});
