import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArchitectureAssessmentReportComponent } from './architecture-assessment-report.component';
import { RouterTestingModule } from '@angular/router/testing';
import { LucideAngularModule } from 'lucide-angular';

describe('ArchitectureAssessmentReportComponent', () => {
  let component: ArchitectureAssessmentReportComponent;
  let fixture: ComponentFixture<ArchitectureAssessmentReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchitectureAssessmentReportComponent, RouterTestingModule, LucideAngularModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ArchitectureAssessmentReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have assessment criteria', () => {
    expect(component.assessedCriteria.length).toBeGreaterThan(0);
  });

  it('should have recommendations', () => {
    expect(component.recommendations.length).toBeGreaterThan(0);
  });
});
