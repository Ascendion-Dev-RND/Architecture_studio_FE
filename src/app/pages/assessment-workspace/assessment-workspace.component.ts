import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-assessment-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './assessment-workspace.component.html',
  styleUrls: ['./assessment-workspace.component.css']
})
export class AssessmentWorkspaceComponent {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Architecture Assessment', link: '/architecture-assessment' },
    { label: 'Workspace' }
  ];

  chatMessages: ChatMessage[] = [];
  userInput: string = '';
  isChatCollapsed: boolean = false;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Get initial prompt from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    
    if (state?.prompt) {
      this.chatMessages.push({
        role: 'user',
        content: state.prompt
      });
      
      // Simulate initial response
      setTimeout(() => {
        this.chatMessages.push({
          role: 'assistant',
          content: 'I\'ll analyze your architecture comprehensively. I\'ll assess risks, NFRs, TOGAF alignment, and best practices compliance. Let me start the evaluation.'
        });
      }, 1000);
    }
  }

  toggleChat(): void {
    this.isChatCollapsed = !this.isChatCollapsed;
  }

  sendMessage(): void {
    if (!this.userInput.trim()) {
      return;
    }

    this.chatMessages.push({
      role: 'user',
      content: this.userInput
    });

    const userMsg = this.userInput;
    this.userInput = '';

    // Simulate AI response
    setTimeout(() => {
      this.chatMessages.push({
        role: 'assistant',
        content: this.getSimulatedResponse(userMsg)
      });
    }, 1000);
  }

  private getSimulatedResponse(userMsg: string): string {
    const lowerMsg = userMsg.toLowerCase();
    
    if (lowerMsg.includes('security') || lowerMsg.includes('risk')) {
      return 'I\'ll prioritize security assessment. I\'ll evaluate authentication, authorization, encryption, and compliance with security frameworks like OWASP.';
    } else if (lowerMsg.includes('performance') || lowerMsg.includes('scalability')) {
      return 'For performance analysis, I\'ll assess latency, throughput, caching strategies, and horizontal scaling capabilities.';
    } else if (lowerMsg.includes('togaf') || lowerMsg.includes('framework')) {
      return 'I\'ll verify TOGAF ADM alignment, including business, data, application, and technology architecture domains.';
    } else if (lowerMsg.includes('cost') || lowerMsg.includes('optimize')) {
      return 'I can evaluate cost optimization opportunities including resource utilization, right-sizing, and architectural efficiency.';
    } else {
      return 'I understand. Let me incorporate that into the assessment. What other areas should I focus on?';
    }
  }

  viewReport(): void {
    this.router.navigate(['/architecture-assessment-report']);
  }
}
