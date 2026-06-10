import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { ArchitectureAssessmentComponent } from './architecture-assessment.component';
import { LucideAngularModule } from 'lucide-angular';
import { Router } from '@angular/router';

describe('ArchitectureAssessmentComponent', () => {
  let component: ArchitectureAssessmentComponent;
  let fixture: ComponentFixture<ArchitectureAssessmentComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ArchitectureAssessmentComponent,
        RouterTestingModule,
        FormsModule,
        LucideAngularModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ArchitectureAssessmentComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display page title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('h1');
    expect(title?.textContent).toContain('Architecture');
    expect(title?.textContent).toContain('Assessment');
  });

  it('should display description', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const description = compiled.querySelector('p.text-muted-foreground');
    expect(description?.textContent).toContain('Review, validate, and assess');
  });

  it('should bind input field to component property', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('input') as HTMLInputElement;
    
    input.value = 'Test architecture';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    
    expect(component.input).toBe('Test architecture');
  });

  it('should navigate to assessment options on send', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.input = 'Test prompt';
    
    component.handleSend();
    
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/assessment-options'],
      jasmine.objectContaining({
        state: { prompt: 'Test prompt' }
      })
    );
  });

  it('should not navigate with empty input', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.input = '   ';
    
    component.handleSend();
    
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should have brand logo linking to home', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const logo = compiled.querySelector('a[routerLink="/"]');
    expect(logo).toBeTruthy();
    expect(logo?.textContent).toContain('Architecture-Studio');
  });
});
