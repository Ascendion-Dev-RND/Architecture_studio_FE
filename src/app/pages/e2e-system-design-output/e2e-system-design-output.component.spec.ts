import { ComponentFixture, TestBed } from '@angular/core/testing';
import { E2ESystemDesignOutputComponent } from './e2e-system-design-output.component';
import { RouterTestingModule } from '@angular/router/testing';
import { LucideAngularModule } from 'lucide-angular';

describe('E2ESystemDesignOutputComponent', () => {
  let component: E2ESystemDesignOutputComponent;
  let fixture: ComponentFixture<E2ESystemDesignOutputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [E2ESystemDesignOutputComponent, RouterTestingModule, LucideAngularModule]
    }).compileComponents();

    fixture = TestBed.createComponent(E2ESystemDesignOutputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have components array', () => {
    expect(component.components.length).toBe(5);
  });

  it('should have prompt property', () => {
    expect(component.prompt).toBeDefined();
  });
});
