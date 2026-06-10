import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

/**
 * BlueprintClarification Component
 * 
 * Clarification page for Solution Blueprint to gather technical details
 * before generating the comprehensive blueprint.
 */
@Component({
  selector: 'app-blueprint-clarification',
  standalone: true,
  imports: [RouterLink, FormsModule, NgFor, NgIf, LucideAngularModule, BreadcrumbComponent],
  templateUrl: './blueprint-clarification.component.html',
  styleUrls: ['./blueprint-clarification.component.css']
})
export class BlueprintClarificationComponent implements OnInit {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Solution Blueprint', link: '/solution-blueprint' },
    { label: 'Clarifications' }
  ];

  prompt: string = '';
  context: string = '';
  attachments: any[] = [];

  // Cloud Provider
  cloudProvider: string = 'aws';
  cloudProviders = [
    { value: 'aws', label: 'Amazon Web Services (AWS)' },
    { value: 'azure', label: 'Microsoft Azure' },
    { value: 'gcp', label: 'Google Cloud Platform (GCP)' },
    { value: 'on-premise', label: 'On-Premise / Hybrid' },
    { value: 'multi-cloud', label: 'Multi-Cloud' }
  ];

  // Container Orchestration (if cloud)
  containerOrchestration: string = 'eks';
  awsOptions = [
    { value: 'eks', label: 'Amazon EKS (Kubernetes)' },
    { value: 'ecs', label: 'Amazon ECS (Docker)' },
    { value: 'fargate', label: 'AWS Fargate (Serverless)' },
    { value: 'ec2', label: 'EC2 Instances' }
  ];
  azureOptions = [
    { value: 'aks', label: 'Azure Kubernetes Service (AKS)' },
    { value: 'aci', label: 'Azure Container Instances' },
    { value: 'app-service', label: 'Azure App Service' }
  ];
  gcpOptions = [
    { value: 'gke', label: 'Google Kubernetes Engine (GKE)' },
    { value: 'cloud-run', label: 'Cloud Run' },
    { value: 'compute-engine', label: 'Compute Engine' }
  ];

  // Backend Tech Stack
  backendTechStack: string = 'spring-boot';
  backendOptions = [
    { value: 'spring-boot', label: 'Spring Boot (Java)' },
    { value: 'node-express', label: 'Node.js + Express' },
    { value: 'dotnet', label: '.NET Core (C#)' },
    { value: 'python-django', label: 'Python + Django' },
    { value: 'python-fastapi', label: 'Python + FastAPI' },
    { value: 'go', label: 'Go (Golang)' },
    { value: 'ruby-rails', label: 'Ruby on Rails' }
  ];

  // Frontend Tech Stack
  frontendTechStack: string = 'react';
  frontendOptions = [
    { value: 'react', label: 'React' },
    { value: 'angular', label: 'Angular' },
    { value: 'vue', label: 'Vue.js' },
    { value: 'nextjs', label: 'Next.js' },
    { value: 'svelte', label: 'Svelte' }
  ];

  // Database
  primaryDatabase: string = 'postgresql';
  databaseOptions = [
    { value: 'postgresql', label: 'PostgreSQL' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'mongodb', label: 'MongoDB' },
    { value: 'dynamodb', label: 'DynamoDB (AWS)' },
    { value: 'cosmosdb', label: 'Cosmos DB (Azure)' },
    { value: 'oracle', label: 'Oracle Database' },
    { value: 'sql-server', label: 'SQL Server' }
  ];

  // Caching
  cachingLayer: string = 'redis';
  cachingOptions = [
    { value: 'redis', label: 'Redis' },
    { value: 'memcached', label: 'Memcached' },
    { value: 'elasticache', label: 'AWS ElastiCache' },
    { value: 'none', label: 'None' }
  ];

  // Message Queue
  messageQueue: string = 'kafka';
  messageQueueOptions = [
    { value: 'kafka', label: 'Apache Kafka' },
    { value: 'rabbitmq', label: 'RabbitMQ' },
    { value: 'sqs', label: 'AWS SQS' },
    { value: 'azure-service-bus', label: 'Azure Service Bus' },
    { value: 'pubsub', label: 'Google Pub/Sub' },
    { value: 'none', label: 'None' }
  ];

  // APM & Observability
  apmTool: string = 'datadog';
  apmOptions = [
    { value: 'datadog', label: 'Datadog' },
    { value: 'new-relic', label: 'New Relic' },
    { value: 'dynatrace', label: 'Dynatrace' },
    { value: 'prometheus-grafana', label: 'Prometheus + Grafana' },
    { value: 'elk', label: 'ELK Stack (Elasticsearch, Logstash, Kibana)' },
    { value: 'cloudwatch', label: 'AWS CloudWatch' },
    { value: 'azure-monitor', label: 'Azure Monitor' },
    { value: 'splunk', label: 'Splunk' }
  ];

  // CI/CD
  cicdTool: string = 'github-actions';
  cicdOptions = [
    { value: 'github-actions', label: 'GitHub Actions' },
    { value: 'gitlab-ci', label: 'GitLab CI/CD' },
    { value: 'jenkins', label: 'Jenkins' },
    { value: 'azure-devops', label: 'Azure DevOps' },
    { value: 'circleci', label: 'CircleCI' },
    { value: 'aws-codepipeline', label: 'AWS CodePipeline' }
  ];

  // Authentication
  authMethod: string = 'oauth2';
  authOptions = [
    { value: 'oauth2', label: 'OAuth 2.0 / OpenID Connect' },
    { value: 'jwt', label: 'JWT (JSON Web Tokens)' },
    { value: 'saml', label: 'SAML 2.0' },
    { value: 'cognito', label: 'AWS Cognito' },
    { value: 'auth0', label: 'Auth0' },
    { value: 'azure-ad', label: 'Azure Active Directory' },
    { value: 'okta', label: 'Okta' }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.prompt = navigation.extras.state['prompt'] || '';
      this.context = navigation.extras.state['context'] || '';
      this.attachments = navigation.extras.state['attachments'] || [];
    }
  }

  get containerOptions() {
    switch (this.cloudProvider) {
      case 'aws':
        return this.awsOptions;
      case 'azure':
        return this.azureOptions;
      case 'gcp':
        return this.gcpOptions;
      default:
        return [];
    }
  }

  generateBlueprint(): void {
    const clarifications = {
      cloudProvider: this.cloudProvider,
      containerOrchestration: this.containerOrchestration,
      backendTechStack: this.backendTechStack,
      frontendTechStack: this.frontendTechStack,
      primaryDatabase: this.primaryDatabase,
      cachingLayer: this.cachingLayer,
      messageQueue: this.messageQueue,
      apmTool: this.apmTool,
      cicdTool: this.cicdTool,
      authMethod: this.authMethod
    };

    this.router.navigate(['/solution-blueprint-output'], {
      state: {
        prompt: this.prompt,
        context: this.context,
        attachments: this.attachments,
        clarifications: clarifications
      }
    });
  }
}
