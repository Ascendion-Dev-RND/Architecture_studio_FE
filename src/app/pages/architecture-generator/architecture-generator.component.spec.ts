import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { ArchitectureGeneratorComponent } from './architecture-generator.component';
import { LucideAngularModule } from 'lucide-angular';
import { Router } from '@angular/router';

describe('ArchitectureGeneratorComponent', () => {
  let component: ArchitectureGeneratorComponent;
  let fixture: ComponentFixture<ArchitectureGeneratorComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ArchitectureGeneratorComponent,
        RouterTestingModule,
        FormsModule,
        LucideAngularModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ArchitectureGeneratorComponent);
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
    expect(title?.textContent).toContain('Generator');
  });

  it('should have empty input and workspace initially', () => {
    expect(component.input).toBe('');
    expect(component.workspace).toBe('');
  });

  it('should have three suggestions', () => {
    expect(component.suggestions.length).toBe(3);
    expect(component.suggestions).toContain('Create a microservices architecture for e-commerce');
  });

  it('should render suggestion chips', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const chips = compiled.querySelectorAll('button');
    const suggestionChips = Array.from(chips).filter(chip => 
      chip.textContent?.includes('microservices') || 
      chip.textContent?.includes('messaging') ||
      chip.textContent?.includes('data pipeline')
    );
    expect(suggestionChips.length).toBe(3);
  });

  it('should set input when suggestion chip is clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const chip = compiled.querySelector('button') as HTMLElement;
    
    chip.click();
    fixture.detectChanges();
    
    expect(component.input).toBeTruthy();
  });

  it('should bind input field to component property', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('input[type="text"]') as HTMLInputElement;
    
    input.value = 'Test architecture';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    
    expect(component.input).toBe('Test architecture');
  });

  it('should navigate to workspace on send with valid input', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.input = 'Test prompt';
    
    component.handleSend();
    
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/architecture-workspace'],
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

  it('should have workspace dropdown', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const select = compiled.querySelector('select');
    expect(select).toBeTruthy();
    
    const options = select?.querySelectorAll('option');
    expect(options?.length).toBe(4); // 1 placeholder + 3 teams
  });

  it('should bind workspace selection', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const select = compiled.querySelector('select') as HTMLSelectElement;
    
    select.value = 'dev-team';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    
    expect(component.workspace).toBe('dev-team');
  });

  it('should have brand logo linking to home', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const logo = compiled.querySelector('a[routerLink="/"]');
    expect(logo).toBeTruthy();
    expect(logo?.textContent).toContain('Architecture-Studio');
  });
});
