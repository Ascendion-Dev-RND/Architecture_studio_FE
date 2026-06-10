import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

interface ModernizationStrategy {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  duration: string;
  effort: string;
  pros: string[];
  risks: string[];
  color: string;
}

@Component({
  selector: 'app-modernization-options',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './modernization-options.component.html',
  styleUrls: ['./modernization-options.component.css']
})
export class ModernizationOptionsComponent implements OnInit {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Modernization Studio', link: '/modernization' },
    { label: 'Options' }
  ];

  systemDescription: string = '';
  cloudModel: string = '';
  timeline: string = '';
  outcomes: string[] = [];
  
  strategies: ModernizationStrategy[] = [
    {
      id: 'replatform',
      name: 'Replatform-First',
      subtitle: 'Kubernetes + CI/CD + Observability',
      icon: 'Server',
      duration: '3-6 months',
      effort: 'M',
      color: 'blue',
      pros: [
        'Fastest time to cloud',
        'Low risk — minimal code changes',
        'Immediate infra benefits (auto-scaling, monitoring)'
      ],
      risks: [
        'Doesn\'t address code-level tech debt',
        'Monolith still deployed as one unit'
      ]
    },
    {
      id: 'strangler',
      name: 'Strangler Domain-by-Domain',
      subtitle: 'DDD Decomposition',
      icon: 'GitBranch',
      duration: '6-12 months',
      effort: 'L',
      color: 'purple',
      pros: [
        'Targeted business value per wave',
        'Gradual risk — no big-bang migration',
        'Clean domain boundaries'
      ],
      risks: [
        'Longer timeline',
        'Requires domain expertise for boundary decisions'
      ]
    },
    {
      id: 'event-driven',
      name: 'Event-Driven Enablement',
      subtitle: 'Kafka + Outbox + Async',
      icon: 'Zap',
      duration: '6-12 months',
      effort: 'L-XL',
      color: 'yellow',
      pros: [
        'Decouples tightly-coupled call chains',
        'Enables real-time data use cases',
        'Natural path to CQRS/event sourcing'
      ],
      risks: [
        'Higher learning curve',
        'Eventual consistency can confuse teams'
      ]
    }
  ];

  selectedStrategy: ModernizationStrategy | null = null;

  constructor(private router: Router) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.systemDescription = navigation.extras.state['systemDescription'] || '';
      this.cloudModel = navigation.extras.state['cloudModel'] || '';
      this.timeline = navigation.extras.state['timeline'] || '';
      this.outcomes = navigation.extras.state['outcomes'] || [];
    }
  }

  ngOnInit(): void {
    // Auto-select first strategy
    this.selectedStrategy = this.strategies[0];
  }

  selectStrategy(strategy: ModernizationStrategy): void {
    this.selectedStrategy = strategy;
  }

  viewToBeArchitecture(): void {
    // Navigate to TO-BE architecture view (would integrate with architecture workspace)
    console.log('View TO-BE Architecture for strategy:', this.selectedStrategy?.id);
    // TODO: Generate architecture based on selected strategy
  }

  getEffortColor(effort: string): string {
    if (effort === 'M') return 'text-yellow-600';
    if (effort === 'L' || effort === 'L-XL') return 'text-orange-600';
    return 'text-green-600';
  }

  getStrategyColorClass(color: string): string {
    const colorMap: { [key: string]: string } = {
      'blue': 'border-blue-500 bg-blue-500/5',
      'purple': 'border-purple-500 bg-purple-500/5',
      'yellow': 'border-yellow-500 bg-yellow-500/5'
    };
    return colorMap[color] || 'border-coral bg-coral/5';
  }

  getStrategyIconColor(color: string): string {
    const colorMap: { [key: string]: string } = {
      'blue': 'text-blue-500',
      'purple': 'text-purple-500',
      'yellow': 'text-yellow-500'
    };
    return colorMap[color] || 'text-coral';
  }
}
