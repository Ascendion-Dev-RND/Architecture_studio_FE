import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { IconService } from '../../services/icon.service';

export interface IconItem {
  id: string;
  name: string;
  category: string;
  iconUrl?: string;
  shapeType?: string;  // 'rectangle'|'circle'|'diamond'|'arrow-right'|'arrow-down'|'line'|'dashed-line'|'cylinder'|'hexagon'|'note'
  lucideIcon?: string; // Lucide icon name for shapes/general
}

interface IconCategory {
  name: string;
  description: string;
  icon: string;
  items: IconItem[];
  expanded: boolean;
}

@Component({
  selector: 'app-component-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './component-panel.component.html',
  styleUrls: ['./component-panel.component.scss']
})
export class ComponentPanelComponent implements OnInit {
  @Output() componentSelected = new EventEmitter<IconItem>();
  @Output() panelClosed = new EventEmitter<void>();

  searchQuery: string = '';
  selectedCategory: string | null = null;

  categories: IconCategory[] = [
    {
      name: 'Shapes & Arrows',
      description: 'Basic shapes, arrows, and connectors',
      icon: 'Pentagon',
      expanded: false,
      items: [
        { id: 'shape-rect', name: 'Rectangle', category: 'shape', shapeType: 'rectangle', lucideIcon: 'Square' },
        { id: 'shape-rounded-rect', name: 'Rounded Rect', category: 'shape', shapeType: 'rounded-rectangle', lucideIcon: 'RectangleHorizontal' },
        { id: 'shape-circle', name: 'Circle', category: 'shape', shapeType: 'circle', lucideIcon: 'Circle' },
        { id: 'shape-diamond', name: 'Diamond', category: 'shape', shapeType: 'diamond', lucideIcon: 'Diamond' },
        { id: 'shape-hexagon', name: 'Hexagon', category: 'shape', shapeType: 'hexagon', lucideIcon: 'Hexagon' },
        { id: 'shape-cylinder', name: 'Cylinder', category: 'shape', shapeType: 'cylinder', lucideIcon: 'Database' },
        { id: 'shape-parallelogram', name: 'Parallelogram', category: 'shape', shapeType: 'parallelogram', lucideIcon: 'Layers' },
        { id: 'shape-note', name: 'Note / Comment', category: 'shape', shapeType: 'note', lucideIcon: 'StickyNote' },
        { id: 'shape-text', name: 'Text Label', category: 'shape', shapeType: 'text', lucideIcon: 'Type' },
        { id: 'shape-group', name: 'Group Box', category: 'shape', shapeType: 'group', lucideIcon: 'Group' },
        { id: 'arrow-right', name: 'Arrow Right', category: 'arrow', shapeType: 'arrow-right', lucideIcon: 'ArrowRight' },
        { id: 'arrow-down', name: 'Arrow Down', category: 'arrow', shapeType: 'arrow-down', lucideIcon: 'ArrowDown' },
        { id: 'arrow-left', name: 'Arrow Left', category: 'arrow', shapeType: 'arrow-left', lucideIcon: 'ArrowLeft' },
        { id: 'arrow-up', name: 'Arrow Up', category: 'arrow', shapeType: 'arrow-up', lucideIcon: 'ArrowUp' },
        { id: 'arrow-bidir', name: 'Bidirectional', category: 'arrow', shapeType: 'arrow-bidir', lucideIcon: 'ArrowLeftRight' },
        { id: 'line-solid', name: 'Solid Line', category: 'arrow', shapeType: 'line', lucideIcon: 'Minus' },
        { id: 'line-dashed', name: 'Dashed Line', category: 'arrow', shapeType: 'dashed-line', lucideIcon: 'MoreHorizontal' },
      ]
    },
    {
      name: 'General Icon',
      description: 'General purpose icons',
      icon: 'Shapes',
      expanded: false,
      items: [
        { id: 'gen-server', name: 'Server', category: 'general', lucideIcon: 'Server' },
        { id: 'gen-database', name: 'Database', category: 'general', lucideIcon: 'Database' },
        { id: 'gen-cloud', name: 'Cloud', category: 'general', lucideIcon: 'Cloud' },
        { id: 'gen-user', name: 'User', category: 'general', lucideIcon: 'User' },
        { id: 'gen-globe', name: 'Globe', category: 'general', lucideIcon: 'Globe' },
        { id: 'gen-lock', name: 'Lock', category: 'general', lucideIcon: 'Lock' },
        { id: 'gen-key', name: 'Key', category: 'general', lucideIcon: 'Key' },
        { id: 'gen-shield', name: 'Shield', category: 'general', lucideIcon: 'Shield' },
        { id: 'gen-monitor', name: 'Monitor', category: 'general', lucideIcon: 'Monitor' },
        { id: 'gen-cpu', name: 'CPU', category: 'general', lucideIcon: 'Cpu' },
        { id: 'gen-network', name: 'Network', category: 'general', lucideIcon: 'Network' },
        { id: 'gen-firewall', name: 'Firewall', category: 'general', lucideIcon: 'ShieldAlert' },
        { id: 'gen-load-balancer', name: 'Load Balancer', category: 'general', lucideIcon: 'GitFork' },
        { id: 'gen-container', name: 'Container', category: 'general', lucideIcon: 'Container' },
        { id: 'gen-queue', name: 'Queue', category: 'general', lucideIcon: 'ListOrdered' },
        { id: 'gen-cache', name: 'Cache', category: 'general', lucideIcon: 'Zap' },
        { id: 'gen-api', name: 'API', category: 'general', lucideIcon: 'Plug' },
        { id: 'gen-webhook', name: 'Webhook', category: 'general', lucideIcon: 'Webhook' },
        { id: 'gen-mobile', name: 'Mobile', category: 'general', lucideIcon: 'Smartphone' },
        { id: 'gen-browser', name: 'Browser', category: 'general', lucideIcon: 'Globe' },
        { id: 'gen-email', name: 'Email', category: 'general', lucideIcon: 'Mail' },
        { id: 'gen-notification', name: 'Notification', category: 'general', lucideIcon: 'Bell' },
        { id: 'gen-search', name: 'Search', category: 'general', lucideIcon: 'Search' },
        { id: 'gen-analytics', name: 'Analytics', category: 'general', lucideIcon: 'BarChart3' },
        { id: 'gen-settings', name: 'Settings', category: 'general', lucideIcon: 'Settings' },
        { id: 'gen-code', name: 'Code', category: 'general', lucideIcon: 'Code2' },
        { id: 'gen-terminal', name: 'Terminal', category: 'general', lucideIcon: 'Terminal' },
        { id: 'gen-file', name: 'File', category: 'general', lucideIcon: 'File' },
        { id: 'gen-folder', name: 'Folder', category: 'general', lucideIcon: 'Folder' },
        { id: 'gen-git', name: 'Git Branch', category: 'general', lucideIcon: 'GitBranch' },
      ]
    },
    {
      name: 'Cloud Provider',
      description: 'AWS, Azure, and Google Cloud',
      icon: 'Cloud',
      expanded: false,
      items: [
        // AWS Compute
        { id: 'aws-lambda', name: 'Lambda', category: 'aws' },
        { id: 'aws-ec2', name: 'EC2', category: 'aws' },
        { id: 'aws-ecs', name: 'ECS', category: 'aws' },
        { id: 'aws-eks', name: 'EKS', category: 'aws' },
        { id: 'aws-fargate', name: 'Fargate', category: 'aws' },
        // AWS Networking
        { id: 'aws-apigateway', name: 'API Gateway', category: 'aws' },
        { id: 'aws-elb', name: 'ALB / ELB', category: 'aws' },
        { id: 'aws-cloudfront', name: 'CloudFront', category: 'aws' },
        { id: 'aws-route53', name: 'Route 53', category: 'aws' },
        { id: 'aws-vpc', name: 'VPC', category: 'aws' },
        // AWS Storage & DB
        { id: 'aws-s3', name: 'S3', category: 'aws' },
        { id: 'aws-rds', name: 'RDS', category: 'aws' },
        { id: 'aws-dynamodb', name: 'DynamoDB', category: 'aws' },
        { id: 'aws-elasticache', name: 'ElastiCache', category: 'aws' },
        { id: 'aws-aurora', name: 'Aurora', category: 'aws' },
        { id: 'aws-redshift', name: 'Redshift', category: 'aws' },
        // AWS Messaging
        { id: 'aws-sqs', name: 'SQS', category: 'aws' },
        { id: 'aws-sns', name: 'SNS', category: 'aws' },
        { id: 'aws-eventbridge', name: 'EventBridge', category: 'aws' },
        { id: 'aws-kinesis', name: 'Kinesis', category: 'aws' },
        { id: 'aws-step-functions', name: 'Step Functions', category: 'aws' },
        // AWS Security
        { id: 'aws-cognito', name: 'Cognito', category: 'aws' },
        { id: 'aws-waf', name: 'WAF', category: 'aws' },
        { id: 'aws-shield', name: 'Shield', category: 'aws' },
        { id: 'aws-iam', name: 'IAM', category: 'aws' },
        { id: 'aws-kms', name: 'KMS', category: 'aws' },
        { id: 'aws-secrets-manager', name: 'Secrets Mgr', category: 'aws' },
        // AWS Monitoring
        { id: 'aws-cloudwatch', name: 'CloudWatch', category: 'aws' },
        { id: 'aws-xray', name: 'X-Ray', category: 'aws' },
        // AWS DevOps
        { id: 'aws-codepipeline', name: 'CodePipeline', category: 'aws' },
        { id: 'aws-cloudformation', name: 'CloudFormation', category: 'aws' },
        // Azure
        { id: 'azure-functions', name: 'Az Functions', category: 'azure' },
        { id: 'azure-app-service', name: 'Az App Service', category: 'azure' },
        { id: 'azure-aks', name: 'Azure AKS', category: 'azure' },
        { id: 'azure-sql', name: 'Azure SQL', category: 'azure' },
        { id: 'azure-cosmos-db', name: 'Cosmos DB', category: 'azure' },
        { id: 'azure-blob-storage', name: 'Az Blob', category: 'azure' },
        { id: 'azure-service-bus', name: 'Service Bus', category: 'azure' },
        { id: 'azure-key-vault', name: 'Key Vault', category: 'azure' },
        // GCP
        { id: 'gcp-cloud-functions', name: 'Cloud Functions', category: 'gcp' },
        { id: 'gcp-cloud-run', name: 'Cloud Run', category: 'gcp' },
        { id: 'gcp-gke', name: 'GKE', category: 'gcp' },
        { id: 'gcp-cloud-sql', name: 'Cloud SQL', category: 'gcp' },
        { id: 'gcp-bigquery', name: 'BigQuery', category: 'gcp' },
        { id: 'gcp-pub-sub', name: 'Pub/Sub', category: 'gcp' },
      ]
    }
  ];

  private iconUrlCache = new Map<string, string>();

  constructor(private iconService: IconService) {}

  ngOnInit(): void {
    // Pre-fetch icon URLs for cloud provider items
    const cloudItems = this.categories.find(c => c.name === 'Cloud Provider')?.items || [];
    cloudItems.forEach(item => {
      this.iconService.getIconUrl(item.id).subscribe({
        next: (url) => {
          item.iconUrl = url;
          this.iconUrlCache.set(item.id, url);
        },
        error: () => {}
      });
    });
  }

  get filteredItems(): IconItem[] {
    const allItems = this.categories.flatMap(c => c.items);

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      return allItems.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query)
      );
    }

    if (this.selectedCategory) {
      const cat = this.categories.find(c => c.name === this.selectedCategory);
      return cat ? cat.items : [];
    }

    return this.categories[0].items;
  }

  toggleCategory(cat: IconCategory) {
    cat.expanded = !cat.expanded;
  }

  selectCategory(category: IconCategory) {
    this.selectedCategory = category.name;
    this.searchQuery = '';
  }

  backToCategories() {
    this.selectedCategory = null;
    this.searchQuery = '';
  }

  onItemClick(item: IconItem) {
    this.componentSelected.emit(item);
  }

  close() {
    this.panelClosed.emit();
  }

  getItemInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  hasIcon(item: IconItem): boolean {
    return !!(item.iconUrl || item.lucideIcon);
  }

  onDragStart(event: DragEvent, item: IconItem): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify(item));
      event.dataTransfer.effectAllowed = 'copy';
    }
  }
}
