import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentOptionsComponent } from './assessment-options.component';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

describe('AssessmentOptionsComponent', () => {
  let component: AssessmentOptionsComponent;
  let fixture: ComponentFixture<AssessmentOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentOptionsComponent, RouterTestingModule, FormsModule, LucideAngularModule]
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 6 assessment criteria', () => {
    expect(component.assessmentCriteria.length).toBe(6);
  });

  it('should start assessment when criteria selected', () => {
    spyOn(component['router'], 'navigate');
    component.startAssessment();
    expect(component['router'].navigate).toHaveBeenCalled();
  });
});
