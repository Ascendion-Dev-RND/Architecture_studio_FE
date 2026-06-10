import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArchitectureWorkspaceComponent } from './architecture-workspace.component';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

describe('ArchitectureWorkspaceComponent', () => {
  let component: ArchitectureWorkspaceComponent;
  let fixture: ComponentFixture<ArchitectureWorkspaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ArchitectureWorkspaceComponent,
        RouterTestingModule,
        FormsModule,
        LucideAngularModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ArchitectureWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have chatInput property', () => {
    expect(component.chatInput).toBeDefined();
    expect(component.chatInput).toBe('');
  });

  it('should have prompt property', () => {
    expect(component.prompt).toBeDefined();
  });

  it('should send message when sendMessage is called', () => {
    spyOn(console, 'log');
    component.chatInput = 'Test message';
    component.sendMessage();
    expect(console.log).toHaveBeenCalledWith('Sending message:', 'Test message');
    expect(component.chatInput).toBe('');
  });

  it('should not send empty message', () => {
    spyOn(console, 'log');
    component.chatInput = '   ';
    component.sendMessage();
    expect(console.log).not.toHaveBeenCalled();
  });

  it('should render chat interface', () => {
    const compiled = fixture.nativeElement;
    const chatHeader = compiled.querySelector('h2');
    expect(chatHeader.textContent).toContain('AI Assistant');
  });

  it('should render canvas area', () => {
    const compiled = fixture.nativeElement;
    const headers = compiled.querySelectorAll('h2');
    expect(headers[1].textContent).toContain('Architecture Canvas');
  });

  it('should render send button', () => {
    const compiled = fixture.nativeElement;
    const sendButton = compiled.querySelector('button');
    expect(sendButton).toBeTruthy();
  });
});
