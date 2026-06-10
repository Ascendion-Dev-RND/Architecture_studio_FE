import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ArchitectureService, E2EDesignResponse, APIEndpoint, DatabaseTable } from '../../services/architecture.service';
import { Subscription } from 'rxjs';
import { MermaidCanvasComponent } from '../../components/mermaid-canvas/mermaid-canvas.component';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';

/**
 * E2ESystemDesignOutput Component
 * 
 * Displays comprehensive end-to-end system design generated from AI
 * Sections include:
 * - Overview and Design Points
 * - Architecture Diagram, Sequence Diagram, ER Diagram
 * - API Specifications, Database Schema
 * - DevOps, Security, Scalability, Tech Stack
 */
@Component({
  selector: 'app-e2e-system-design-output',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, NgClass, LucideAngularModule, MermaidCanvasComponent, BreadcrumbComponent],
  templateUrl: './e2e-system-design-output.component.html',
  styleUrls: ['./e2e-system-design-output.component.css']
})
export class E2ESystemDesignOutputComponent implements OnInit, OnDestroy {
  breadcrumbItems = [
    { label: 'Architecture Studio', link: '/' },
    { label: 'Solution Blueprint', link: '/solution-blueprint' },
    { label: 'Output' }
  ];

  prompt: string = 'System Design';
  context: string = '';
  attachments: any[] = [];
  clarifications: any = {};
  
  // Loading state
  isLoading: boolean = true;
  errorMessage: string = '';
  
  // Dynamic data from API
  designData: E2EDesignResponse | null = null;
  loading = true;
  error: string | null = null;
  hasCloudArchitecture = false;
  private subscription?: Subscription;

  // Section 1-4: Background, Scope, Out of Scope, Proposed Solution
  backgroundContent = 'This document outlines the end-to-end system design for a modern, cloud-native enterprise application. The architecture is designed to handle high-volume transactions, support millions of users, and integrate seamlessly with existing enterprise systems. The solution prioritizes scalability, security, resilience, and operational excellence. Built on industry best practices and proven architectural patterns, the system ensures business continuity through fault-tolerant design, automated disaster recovery, and comprehensive monitoring. The architecture supports both synchronous and asynchronous communication patterns, enabling real-time processing and eventual consistency where appropriate. This design aligns with enterprise governance, compliance requirements (GDPR, SOC 2, HIPAA), and incorporates zero-trust security principles throughout the stack.';

  scopeItems = [
    'Design and implementation of core business functionality including user management, transaction processing, and business logic',
    'Integration with existing enterprise systems (ERP, CRM, Identity Management) via secure APIs and message queues',
    'User authentication and authorization mechanisms with Single Sign-On (SSO), Multi-Factor Authentication (MFA), and RBAC',
    'Data storage and management solutions including relational databases, NoSQL stores, caching layers, and data warehousing',
    'RESTful and GraphQL API design and development with comprehensive OpenAPI documentation and versioning strategy',
    'Monitoring and logging infrastructure with distributed tracing, metrics collection, alerting, and observability dashboards',
    'Cloud infrastructure provisioning and configuration management using Infrastructure as Code (IaC) principles',
    'CI/CD pipeline implementation with automated testing, security scanning, and deployment automation',
    'Data backup, disaster recovery, and business continuity planning with defined RPO/RTO targets',
    'Performance optimization and load testing to meet defined SLA requirements',
    'Security hardening including vulnerability scanning, penetration testing, and compliance auditing'
  ];

  outOfScopeItems = [
    'Legacy system migration and data transfer (handled as separate project with dedicated migration team)',
    'Native mobile application development for iOS and Android (mobile-first web app will be provided)',
    'Third-party vendor integrations beyond the specified APIs listed in integration requirements',
    'Custom data migration from deprecated systems older than 5 years (requires separate assessment)',
    'Advanced AI/ML model development and training (basic analytics and reporting will be included)',
    'Blockchain and cryptocurrency payment integration',
    'Physical infrastructure procurement and data center operations (cloud-native deployment only)',
    'End-user training materials and documentation (will be handled by training department)',
    'Legacy desktop application support and maintenance'
  ];

  proposedSolutionContent = 'The proposed solution leverages a microservices architecture deployed on Kubernetes clusters across multiple availability zones for high availability and fault tolerance. The architecture follows Domain-Driven Design (DDD) principles with clearly defined bounded contexts, enabling independent team ownership and autonomous service deployment. Event-driven communication via Apache Kafka ensures loose coupling while maintaining data consistency through event sourcing and CQRS patterns where appropriate. The API Gateway serves as the single entry point, handling cross-cutting concerns such as authentication, authorization, rate limiting, and request routing. All services are containerized using Docker, promoting consistency across development, staging, and production environments. The solution incorporates the Circuit Breaker pattern for resilience, distributed caching with Redis for performance, and comprehensive observability through the ELK stack and Prometheus/Grafana monitoring. Infrastructure is managed as code using Terraform, enabling reproducible deployments and disaster recovery. The CI/CD pipeline built on GitHub Actions ensures rapid, reliable, and secure software delivery with automated testing, security scanning, and blue-green deployments to minimize downtime.';

  // Section 5: High-Level Architecture
  architectureDetails = [
    'Presentation Layer: React 18 SPA with TypeScript, Redux Toolkit for state management, React Query for server state, and Material-UI components. Progressive Web App (PWA) capabilities with offline support and responsive design optimized for desktop, tablet, and mobile devices',
    'CDN Layer: CloudFlare CDN for static asset delivery, edge caching, DDoS protection, and global content distribution with 99.99% uptime SLA',
    'API Gateway: Kong Gateway serving as the single entry point for all client requests, handling OAuth2 authentication, JWT validation, rate limiting (1000 req/min per user), request/response transformation, API versioning, and intelligent routing to backend services',
    'Load Balancer: Application Load Balancer (ALB) with SSL/TLS termination, health checks, sticky sessions, and automatic failover across multiple availability zones',
    'Service Mesh: Istio service mesh for secure mTLS communication between services, traffic management, circuit breaking, retry logic, and distributed tracing with Jaeger integration',
    'Business Services Layer: Domain-driven microservices organized by bounded contexts (User, Order, Payment, Inventory, Notification, Analytics) with independent databases and deployment pipelines',
    'Data Access Layer: Repository pattern with ORM (TypeORM/Prisma), connection pooling, read replicas for query optimization, and database migration management',
    'Data Storage Layer: Polyglot persistence approach - PostgreSQL 14 for transactional data, MongoDB for document storage, Redis Cluster for caching and session management, Elasticsearch for full-text search and analytics',
    'Message Broker Layer: Apache Kafka cluster (3+ brokers) for event streaming, pub/sub messaging, event sourcing, and asynchronous inter-service communication with guaranteed delivery',
    'Integration Layer: Enterprise Service Bus (ESB) patterns for legacy system integration, API adapters for third-party services, and webhook handlers for real-time notifications',
    'Caching Layer: Multi-tier caching strategy with Redis Cluster (in-memory cache), application-level caching (node-cache), and CDN edge caching for optimal performance',
    'Security Layer: WAF (Web Application Firewall) for protection against OWASP Top 10 threats, API security with OAuth2/OpenID Connect, secrets management with HashiCorp Vault, and network security with VPC, subnets, and security groups'
  ];

  // Section 6: Security View
  securityApproach = [
    { aspect: 'Authentication', detail: 'OAuth 2.0 with OpenID Connect (OIDC) for identity federation, supporting SSO with corporate IdP (Okta/Azure AD). Multi-Factor Authentication (MFA) via SMS, email, and authenticator apps. Biometric authentication support for mobile devices. Password policies enforce minimum 12 characters with complexity requirements. Account lockout after 5 failed attempts with exponential backoff' },
    { aspect: 'Authorization', detail: 'Role-Based Access Control (RBAC) with hierarchical role inheritance and fine-grained permissions at resource level. Attribute-Based Access Control (ABAC) for complex authorization rules. Policy-based access using Open Policy Agent (OPA). Principle of least privilege enforced across all services. Dynamic permission evaluation with context-aware access decisions' },
    { aspect: 'Data Encryption', detail: 'AES-256-GCM encryption at rest for all databases and file storage. TLS 1.3 mandatory for all data in transit with perfect forward secrecy. Encryption key rotation every 90 days managed by AWS KMS/Azure Key Vault. Field-level encryption for PII and sensitive data. Database transparent data encryption (TDE) enabled. Encrypted backups with separate encryption keys' },
    { aspect: 'API Security', detail: 'JWT tokens with RS256 signing algorithm, 15-minute expiry, and secure refresh token flow. API keys with IP whitelisting and usage quotas. Rate limiting: 1000 req/min per user, 10000 req/min per org. Request signing for sensitive operations. CORS policies strictly configured. API versioning with deprecation notices. Input validation and sanitization against injection attacks' },
    { aspect: 'Network Security', detail: 'Zero-trust network architecture with microsegmentation. VPC with public/private subnets across multiple AZs. Network ACLs and Security Groups with principle of least privilege. WAF rules protecting against OWASP Top 10 threats. DDoS protection with rate limiting and IP reputation filtering. VPN and bastion hosts for administrative access. Private endpoints for internal services' },
    { aspect: 'Audit Logging', detail: 'Comprehensive audit trails capturing all security events, user actions, data access, and configuration changes. Immutable logs stored in append-only S3 with WORM (Write Once Read Many) protection. Log retention: 7 years for compliance. Real-time security monitoring and alerting. SIEM integration for threat detection. Automated compliance reporting for SOC 2, GDPR, HIPAA' },
    { aspect: 'Vulnerability Management', detail: 'Automated vulnerability scanning with Snyk, Aqua Security for containers. Weekly penetration testing by certified ethical hackers. Dependency scanning in CI/CD pipeline. SAST (Static Application Security Testing) and DAST (Dynamic Application Security Testing). Bug bounty program for responsible disclosure. Quarterly security audits by third-party firms. Patch management with 72-hour SLA for critical vulnerabilities' },
    { aspect: 'Secrets Management', detail: 'HashiCorp Vault for centralized secrets management with dynamic secrets generation. Secrets rotation every 30 days. No hardcoded credentials in codebase or config files. Environment-specific secrets with access controls. Secret encryption with Vault transit engine. Audit logging of all secret access. Integration with CI/CD for secure secret injection' },
    { aspect: 'Incident Response', detail: '24/7 Security Operations Center (SOC) monitoring. Automated incident detection and alerting. Incident response playbooks for common scenarios. Mean Time To Detect (MTTD) < 15 minutes, Mean Time To Respond (MTTR) < 1 hour. Post-incident forensics and root cause analysis. Compliance with incident notification requirements (72-hour GDPR notification)' }
  ];

  // Section 7: Non-Functional Requirements
  nfrRequirements = [
    { category: 'Performance', requirement: 'API response time < 200ms (P95), < 100ms (P50). Page load time < 2 seconds. Database query execution < 50ms. Throughput: 10,000 transactions per second (TPS) sustained, 25,000 TPS peak' },
    { category: 'Availability', requirement: '99.95% uptime SLA (21.6 minutes downtime per month). Zero-downtime deployments using blue-green strategy. Automatic failover < 30 seconds. Multi-region active-active deployment. Health checks every 10 seconds' },
    { category: 'Scalability', requirement: 'Support 100,000 concurrent users with horizontal pod autoscaling (HPA). Vertical scaling for databases with read replicas (1 primary, 3 replicas). Auto-scaling triggers at 70% CPU/memory utilization. Geographic distribution across 3+ regions. Support 10x traffic spikes during peak periods' },
    { category: 'Reliability', requirement: 'Mean Time Between Failures (MTBF) > 720 hours. Error rate < 0.1% of total requests. Circuit breaker activation at 50% error rate. Retry logic with exponential backoff. Graceful degradation for non-critical features' },
    { category: 'Recovery', requirement: 'RPO (Recovery Point Objective): 15 minutes with continuous backup. RTO (Recovery Time Objective): 1 hour for critical services, 4 hours for full system. Automated disaster recovery drills quarterly. Cross-region backup replication' },
    { category: 'Maintainability', requirement: 'Mean Time To Repair (MTTR) < 2 hours. Automated rollback on deployment failures. Comprehensive API documentation with Swagger/OpenAPI. Code coverage > 80% for unit tests. Technical debt ratio < 5%' },
    { category: 'Security', requirement: 'Zero critical vulnerabilities in production. Penetration testing pass rate > 95%. Security incident response time < 1 hour. Compliance certifications: SOC 2 Type II, ISO 27001, PCI-DSS Level 1' },
    { category: 'Compliance', requirement: 'GDPR compliance with data residency in EU for European users. CCPA compliance for California residents. HIPAA compliance for healthcare data. SOC 2 Type II certification. Right to erasure (RTBF) implementation < 30 days. Data portability in machine-readable format' },
    { category: 'Usability', requirement: 'WCAG 2.1 Level AA accessibility compliance. Mobile-first responsive design. Support for latest 2 versions of Chrome, Firefox, Safari, Edge. Offline capabilities for core features. Internationalization (i18n) support for 10+ languages' },
    { category: 'Monitoring', requirement: 'Real-time monitoring with < 1 minute metric granularity. Distributed tracing for 100% of requests. Log aggregation and analysis. Alerting with PagerDuty integration. SLA dashboard with real-time metrics' }
  ];

  // Section 8: Technology Stack
  techStack = [
    { layer: 'Frontend', primary: 'React 18 + TypeScript, Redux Toolkit, React Query, Material-UI v5', alternatives: 'Vue 3 + Composition API, Angular 16+, Svelte Kit' },
    { layer: 'Backend', primary: 'Node.js 20 LTS + NestJS 10, TypeScript, Express.js', alternatives: 'Java 17 + Spring Boot 3, Go 1.21 + Gin, Python 3.11 + FastAPI' },
    { layer: 'API Gateway', primary: 'Kong Gateway 3.x with OAuth2, Rate Limiting plugins', alternatives: 'AWS API Gateway, Nginx Plus, Tyk, Ambassador' },
    { layer: 'Database (SQL)', primary: 'PostgreSQL 14 with pgBouncer connection pooling, TimescaleDB', alternatives: 'MySQL 8.0, MariaDB 10.11, CockroachDB, Amazon Aurora' },
    { layer: 'Database (NoSQL)', primary: 'MongoDB 6.0 with replica set, sharding enabled', alternatives: 'Cassandra 4.x, DynamoDB, Couchbase, Azure Cosmos DB' },
    { layer: 'Cache', primary: 'Redis 7.x Cluster (6 nodes), Redis Sentinel for HA', alternatives: 'Memcached, Hazelcast, Apache Ignite, Amazon ElastiCache' },
    { layer: 'Search Engine', primary: 'Elasticsearch 8.x with Kibana, Logstash (ELK Stack)', alternatives: 'Apache Solr, Algolia, Meilisearch, Typesense' },
    { layer: 'Message Queue', primary: 'Apache Kafka 3.5 (3+ brokers), Kafka Connect, Schema Registry', alternatives: 'RabbitMQ 3.12, AWS SQS/SNS, Azure Service Bus, Google Pub/Sub' },
    { layer: 'Container Runtime', primary: 'Docker 24.x, containerd 1.7', alternatives: 'Podman, CRI-O, LXC' },
    { layer: 'Orchestration', primary: 'Kubernetes 1.28 (EKS/AKS/GKE), Helm 3.x, Kustomize', alternatives: 'Docker Swarm, AWS ECS, Nomad, OpenShift' },
    { layer: 'Service Mesh', primary: 'Istio 1.19 with Envoy proxy, Jaeger for tracing', alternatives: 'Linkerd, Consul Connect, AWS App Mesh' },
    { layer: 'CI/CD', primary: 'GitHub Actions, ArgoCD for GitOps, SonarQube for code quality', alternatives: 'GitLab CI/CD, Jenkins X, CircleCI, Azure DevOps, Tekton' },
    { layer: 'Infrastructure as Code', primary: 'Terraform 1.6, AWS CloudFormation, Ansible', alternatives: 'Pulumi, AWS CDK, Azure ARM Templates, Google Deployment Manager' },
    { layer: 'Monitoring', primary: 'Prometheus + Grafana, Thanos for long-term storage', alternatives: 'Datadog, New Relic, Dynatrace, AppDynamics, Elastic APM' },
    { layer: 'Logging', primary: 'ELK Stack (Elasticsearch, Logstash, Kibana), Fluentd', alternatives: 'Splunk, Graylog, Loki + Promtail, CloudWatch Logs' },
    { layer: 'Distributed Tracing', primary: 'Jaeger with OpenTelemetry instrumentation', alternatives: 'Zipkin, AWS X-Ray, Lightstep, Honeycomb' },
    { layer: 'Secrets Management', primary: 'HashiCorp Vault, AWS Secrets Manager', alternatives: 'Azure Key Vault, Google Secret Manager, CyberArk' },
    { layer: 'Load Balancer', primary: 'AWS ALB/NLB, Nginx Ingress Controller', alternatives: 'HAProxy, Traefik, F5 BIG-IP, Azure Load Balancer' },
    { layer: 'CDN', primary: 'CloudFlare Enterprise, AWS CloudFront', alternatives: 'Akamai, Fastly, Azure CDN, Google Cloud CDN' },
    { layer: 'Object Storage', primary: 'AWS S3 with versioning and lifecycle policies', alternatives: 'Azure Blob Storage, Google Cloud Storage, MinIO' }
  ];

  // Section 9: Microservices
  microservices = [
    { name: 'User Service', responsibility: 'User registration, profile management, preferences, CRUD operations. Handles user lifecycle events. Database: PostgreSQL. Tech: Node.js + NestJS. API: RESTful. Scaling: 3-10 pods' },
    { name: 'Auth Service', responsibility: 'Authentication, authorization, JWT token generation/validation, SSO integration with Okta/Azure AD, MFA, session management. Database: Redis for sessions. Tech: Node.js + Passport.js. API: OAuth2/OIDC. Scaling: 5-15 pods' },
    { name: 'Order Service', responsibility: 'Order creation, status tracking, workflow orchestration, saga pattern for distributed transactions. Event sourcing for audit trail. Database: PostgreSQL + Event Store. Tech: Node.js + NestJS. API: RESTful + Events. Scaling: 3-12 pods' },
    { name: 'Payment Service', responsibility: 'Payment processing with Stripe/PayPal, transaction management, refunds, PCI-DSS compliance. Idempotency keys for safety. Database: PostgreSQL. Tech: Node.js with encryption. API: RESTful. Scaling: 5-20 pods (critical service)' },
    { name: 'Inventory Service', responsibility: 'Product inventory management, stock levels, reservation system with optimistic locking. Real-time stock updates via Kafka events. Database: PostgreSQL. Tech: Go for high performance. API: gRPC + REST. Scaling: 3-10 pods' },
    { name: 'Product Catalog Service', responsibility: 'Product information, categories, search integration with Elasticsearch. Image management with S3. CDN integration. Database: MongoDB for flexibility. Tech: Node.js. API: GraphQL. Scaling: 3-8 pods' },
    { name: 'Notification Service', responsibility: 'Multi-channel notifications: Email (SendGrid), SMS (Twilio), Push (FCM), webhooks. Template management, retry logic, delivery tracking. Database: MongoDB. Tech: Python + Celery. Queue: RabbitMQ. Scaling: 2-8 pods' },
    { name: 'Analytics Service', responsibility: 'Real-time business metrics, data aggregation, reporting dashboard. Integration with data warehouse. Database: TimescaleDB + Clickhouse. Tech: Python + Pandas. API: RESTful. Scaling: 2-6 pods' },
    { name: 'Search Service', responsibility: 'Full-text search, filters, facets, autocomplete. Elasticsearch cluster management, index optimization. Database: Elasticsearch. Tech: Node.js + Elasticsearch client. API: RESTful. Scaling: 3-10 pods' },
    { name: 'Media Service', responsibility: 'Image/video upload, processing, resizing, CDN distribution. S3 integration. Database: PostgreSQL for metadata. Tech: Node.js + Sharp. Storage: AWS S3. API: RESTful. Scaling: 2-8 pods' }
  ];

  crossCuttingComponents = [
    { name: 'API Gateway (Kong)', purpose: 'Single entry point for all client requests. Handles authentication (OAuth2, JWT), rate limiting (1000 req/min per user), request routing, load balancing, CORS, API versioning, request/response transformation. Plugins: OAuth2, Rate Limiting, CORS, Prometheus' },
    { name: 'Service Mesh (Istio)', purpose: 'Secure service-to-service communication with mTLS. Traffic management: canary deployments, A/B testing, circuit breaking. Observability: distributed tracing with Jaeger, metrics collection. Resilience: retries, timeouts, fault injection for chaos testing' },
    { name: 'Config Server (Spring Cloud Config)', purpose: 'Centralized configuration management for all services. Environment-specific configs (dev/staging/prod). Dynamic configuration refresh without service restart. Git-backed configuration. Encryption for sensitive values. Config versioning and rollback' },
    { name: 'Service Registry (Consul)', purpose: 'Service discovery and health monitoring. Dynamic service registration/deregistration. Health checks every 10 seconds. DNS and HTTP interface. Key-value store for service metadata. Multi-datacenter support' },
    { name: 'Log Aggregator (ELK Stack)', purpose: 'Centralized logging with Elasticsearch for storage, Logstash for processing, Kibana for visualization. Fluentd for log collection from all services. Log retention: 30 days hot, 90 days warm, 1 year cold. Full-text search across logs. Real-time log streaming' },
    { name: 'Metrics Collector (Prometheus)', purpose: 'Time-series metrics collection from all services. Custom business metrics and technical metrics (CPU, memory, latency). Alerting rules with AlertManager. Grafana dashboards for visualization. Metrics retention: 15 days local, 1 year with Thanos' },
    { name: 'Distributed Tracing (Jaeger)', purpose: 'End-to-end request tracing across microservices. Performance bottleneck identification. Dependency graph visualization. OpenTelemetry instrumentation. Trace sampling: 100% for errors, 1% for successful requests' },
    { name: 'Secrets Manager (HashiCorp Vault)', purpose: 'Centralized secrets storage and management. Dynamic secrets generation with auto-rotation every 30 days. Encryption key management. Database credentials rotation. Access control with policies. Audit logging of all secret access' },
    { name: 'Message Broker (Apache Kafka)', purpose: 'Event streaming platform for asynchronous communication. Topics for different event types. Guarantees: exactly-once semantics. Retention: 7 days. Replication factor: 3. Partitioning for parallelism. Schema Registry for event schema evolution' },
    { name: 'Caching Layer (Redis Cluster)', purpose: 'Distributed caching for session management, API responses, database query results. 6-node cluster for high availability. TTL-based eviction. LRU cache policy. Pub/Sub for cache invalidation. Redis Sentinel for automatic failover' }
  ];

  // Section 10: Deliverables
  deliverables = [
    'System Architecture Document (SAD) - 100+ pages covering architecture decisions, patterns, trade-offs',
    'API Specifications (OpenAPI 3.0) - Complete REST/GraphQL API documentation with examples and Postman collections',
    'Database Schema Design - ER diagrams, table schemas, indexes, constraints, migration scripts',
    'Infrastructure as Code (Terraform) - Complete cloud infrastructure provisioning for all environments',
    'CI/CD Pipeline Configuration - GitHub Actions workflows, ArgoCD manifests, deployment automation',
    'Security Assessment Report - Vulnerability scanning results, penetration test findings, remediation plans',
    'Performance Test Results - Load testing reports with JMeter/K6, baseline metrics, optimization recommendations',
    'Deployment Runbooks - Step-by-step deployment procedures, rollback strategies, troubleshooting guides',
    'Operations Manual - SRE playbooks, incident response procedures, escalation paths, on-call guidelines',
    'Disaster Recovery Plan - DR procedures, RTO/RPO documentation, failover testing results',
    'Monitoring & Alerting Setup - Grafana dashboards, Prometheus alert rules, PagerDuty integration',
    'Data Migration Scripts - ETL scripts for legacy system migration, data validation procedures',
    'API Client SDKs - Generated SDKs for JavaScript, Python, Java with usage examples',
    'Architectural Decision Records (ADRs) - 20+ ADRs documenting key architectural choices',
    'Security Compliance Documentation - SOC 2, GDPR, HIPAA compliance evidence, audit trails',
    'Training Materials - Developer onboarding guides, architecture overview presentations, video tutorials',
    'Technical Debt Register - Documented shortcuts, planned refactoring, prioritized improvements',
    'Cost Analysis Report - Cloud cost projections, optimization opportunities, budget recommendations'
  ];

  // Section 11: Deployment Architecture
  deploymentDetails = [
    { env: 'Production (Primary Region - us-east-1)', config: 'Multi-AZ deployment across 3 availability zones. EKS cluster with 15-50 worker nodes (t3.xlarge). Auto-scaling based on CPU/memory (HPA) and custom metrics. Blue-green deployment strategy. Load balanced with AWS ALB. RDS PostgreSQL Multi-AZ with 3 read replicas. ElastiCache Redis cluster (6 nodes). S3 with cross-region replication. CloudFront CDN. 99.95% uptime SLA' },
    { env: 'Production (DR Region - us-west-2)', config: 'Warm standby deployment for disaster recovery. Reduced capacity: 5-20 worker nodes. Continuous data replication from primary region. RDS cross-region read replica promoted to standalone during DR. Automated failover with Route53 health checks. RPO: 15 minutes, RTO: 1 hour. Monthly DR drills' },
    { env: 'Staging', config: 'Production-like environment for final testing. Single region (us-east-1), 2 AZs. 5-15 worker nodes (t3.large). Blue-green deployments. Anonymized production data snapshots refreshed weekly. Integration testing with external services (mocked payment gateways). Performance testing environment. Access restricted to QA team' },
    { env: 'Development', config: 'Lightweight cluster for active development. Single AZ. 3-8 worker nodes (t3.medium). Rolling updates. Local development with Minikube/Kind supported. PostgreSQL single instance. Redis single node. S3 bucket for testing. Automatic cleanup of unused resources. Access for all developers' },
    { env: 'QA/Testing', config: 'Dedicated environment for automated testing. 3-10 worker nodes. Ephemeral environments created per PR. Automated deployment on PR merge. Integration with test automation frameworks (Jest, Cypress). Test data management. Parallel test execution. Nightly full regression test suite' },
    { env: 'Performance Testing', config: 'Isolated environment for load testing. Production-scale infrastructure. 10-30 worker nodes. Dedicated load testing tools (JMeter, K6, Gatling). Monitoring with Prometheus/Grafana. Baseline performance benchmarks. Scheduled weekly performance regression tests' }
  ];

  // Section 12: Implementation Timeline
  timeline = [
    { phase: 'Phase 1: Foundation & Infrastructure (Weeks 1-4)', duration: '4 weeks', activities: 'Cloud account setup and configuration. Terraform IaC development for all environments. Kubernetes cluster provisioning (EKS/AKS). VPC, subnets, security groups setup. CI/CD pipeline implementation with GitHub Actions. ArgoCD for GitOps. Development environment setup. Database provisioning (PostgreSQL, MongoDB, Redis). API Gateway and Service Mesh installation (Kong, Istio). Monitoring stack deployment (Prometheus, Grafana, ELK). Team: DevOps Engineers (3), Cloud Architects (2)' },
    { phase: 'Phase 2: Core Services Development (Weeks 5-12)', duration: '8 weeks', activities: 'Microservices development: User, Auth, Order, Payment, Inventory, Product Catalog services. RESTful API implementation with OpenAPI specs. Database schema design and migrations. Event-driven communication with Kafka. Unit testing (80% code coverage target). Integration testing. API documentation with Swagger. Docker containerization. Service deployment to dev/staging environments. Code reviews and pair programming. Team: Backend Developers (8), Frontend Developers (4), QA Engineers (3)' },
    { phase: 'Phase 3: Security Hardening & NFR (Weeks 13-15)', duration: '3 weeks', activities: 'OAuth2/OIDC implementation with Okta integration. RBAC and fine-grained permissions. Secrets management with Vault. Data encryption at rest and in transit. Security scanning (SAST, DAST) with Snyk, SonarQube. Penetration testing. Performance testing with K6 (10K+ concurrent users). Load balancing optimization. Database query optimization and indexing. Caching strategy implementation. API rate limiting and throttling. Compliance documentation (GDPR, SOC 2). Team: Security Engineers (3), Performance Engineers (2), Compliance Officer (1)' },
    { phase: 'Phase 4: Production Deployment (Weeks 16-17)', duration: '2 weeks', activities: 'Production environment final setup and validation. Blue-green deployment to production. Database migration execution. DNS and SSL certificate configuration. CDN setup (CloudFlare/CloudFront). Smoke testing in production. Load testing at scale. Monitoring and alerting verification. PagerDuty integration and on-call setup. Disaster recovery drill. Production readiness checklist sign-off. Go-live approval from stakeholders. Team: DevOps (3), SRE (2), Tech Leads (2), Project Manager' },
    { phase: 'Phase 5: Stabilization & Hypercare (Weeks 18-20)', duration: '3 weeks', activities: '24/7 production monitoring and support. Bug triage and hot-fix deployments. Performance tuning based on real user data. User feedback collection and prioritization. Documentation completion (runbooks, operations manual). Knowledge transfer sessions to operations team. Training for support team. Post-launch retrospective. Technical debt documentation. Continuous optimization. Transition to BAU (Business As Usual). Team: Full team on standby, SRE (2), Support Engineers (4)' },
    { phase: 'Phase 6: Post-Launch Enhancements (Weeks 21-24)', duration: '4 weeks', activities: 'Feature enhancements based on user feedback. Technical debt reduction. Advanced analytics implementation. A/B testing framework. Progressive rollout of new features. Multi-region expansion planning. Cost optimization. Auto-scaling fine-tuning. Performance baseline establishment. SLA monitoring and reporting. Team: Development team (reduced capacity), Product Manager' }
  ];

  // Section 13: Assumptions
  assumptions = [
    'Cloud Infrastructure: AWS account with appropriate service limits is available. IAM roles and policies can be configured. Budget approved for estimated $50K-80K/month cloud spend (production). Network connectivity and VPN access to corporate network established',
    'Team Expertise: Development team (12+ engineers) has experience with Node.js, React, microservices, Kubernetes. DevOps team (3 engineers) proficient in Terraform, AWS, CI/CD. At least 2 senior architects available for design reviews and technical guidance. Team has access to required training and certifications',
    'Third-Party Services: Payment gateway (Stripe/PayPal) API access and sandbox environment available. Email service provider (SendGrid) account provisioned with sufficient quota. SMS provider (Twilio) integration approved. Corporate SSO/IdP (Okta/Azure AD) integration supported with technical documentation',
    'Stakeholder Availability: Product Owner available for weekly sprint reviews and backlog refinement. Business stakeholders available for bi-weekly demos. Security team available for weekly security review meetings. Compliance team responsive for GDPR/SOC2 requirements. Legal team available for vendor contract reviews',
    'Requirements Stability: Core requirements are finalized and signed off. No major scope changes during Phases 1-3. Change requests follow formal change control process. New features planned for post-launch phases. API contracts agreed upon and versioned',
    'Data & Integration: Legacy system APIs documented and accessible. Data migration plan approved by data governance team. Test data available for all environments. Data retention policies defined. Third-party integration SLAs acceptable (99.5%+ uptime)',
    'Security & Compliance: Security policies and standards documented. Penetration testing window approved (2 weeks). Compliance requirements clearly defined (GDPR, SOC 2, HIPAA if applicable). Security exception process in place. Vulnerability remediation SLA: Critical (72 hours), High (7 days)',
    'Testing: QA team (3 engineers) dedicated full-time. Test automation framework in place (Jest, Cypress). Performance testing tools licensed (K6, JMeter). Test data management strategy defined. Access to production-like staging environment',
    'Operations: 24/7 on-call support team identified post-launch. Incident management process defined. SLA targets agreed: 99.95% uptime, < 200ms API response time. Disaster recovery plan approved with quarterly DR drills. Operations runbooks will be created during development',
    'Timeline: 20-week timeline is based on 12-person development team. Key technical resources available throughout project. No major holidays or team vacations during critical phases. Weekly sprints with 2-week sprint reviews. Buffer time included for unforeseen issues (10% contingency)'
  ];

  // Section 14: Dependencies
  dependencies = [
    { dependency: 'Identity Provider (Okta/Azure AD)', status: 'Critical', notes: 'SSO integration required for authentication. API credentials and technical documentation needed by Week 2. Test tenant access for development. SAML/OIDC federation configured. Impact if delayed: Blocks authentication implementation (Phase 2)' },
    { dependency: 'Payment Gateway (Stripe/PayPal)', status: 'Critical', notes: 'Merchant account approval and API keys needed by Week 6. PCI-DSS compliance certification required. Webhook endpoints configuration. Sandbox environment for testing. Production credentials before go-live. Impact if delayed: Blocks payment feature (Phase 2)' },
    { dependency: 'Email Service Provider (SendGrid/AWS SES)', status: 'Required', notes: 'Account provisioned with 100K+ emails/month quota. Domain verification and SPF/DKIM setup. API keys by Week 5. Email templates and deliverability monitoring. Impact if delayed: Blocks notification service (Phase 2)' },
    { dependency: 'SMS Provider (Twilio)', status: 'Required', notes: 'Account with international SMS capability. Phone number verification for MFA. API credentials by Week 5. Compliance with SMS regulations (TCPA). Impact if delayed: MFA feature delayed' },
    { dependency: 'Cloud Provider (AWS)', status: 'Critical', notes: 'Production-ready AWS account with Organization setup. Service limits increased (EC2, RDS, ELB). Budget allocated and approved ($50-80K/month). IAM roles configured by Week 1. Support plan (Business or Enterprise). Impact if delayed: Blocks entire project' },
    { dependency: 'Domain Name & SSL Certificates', status: 'Required', notes: 'Domain purchased and DNS managed via Route53/CloudFlare. SSL certificates (wildcard) from ACM or Let\'s Encrypt. DNS propagation time (24-48 hours). CDN integration. Needed by Week 15. Impact if delayed: Blocks production deployment' },
    { dependency: 'Corporate VPN & Network Access', status: 'Required', notes: 'VPN access for development team to corporate network. Firewall rules for database access from development machines. IP whitelisting for CI/CD pipeline. Private endpoint access. Needed by Week 1. Impact if delayed: Blocks development setup' },
    { dependency: 'Monitoring & Logging SaaS (Optional)', status: 'Required', notes: 'If using Datadog/New Relic instead of self-hosted Prometheus. Account provisioned by Week 3. Agent installation approved. Log retention quota sufficient. API keys for integration. Impact if delayed: Limited observability in early phases' },
    { dependency: 'Source Code Repository (GitHub Enterprise)', status: 'Critical', notes: 'GitHub organization created with appropriate licenses. Team access provisioned. Branch protection rules configured. GitHub Actions minutes quota sufficient (10K+ min/month). Needed by Week 1. Impact if delayed: Blocks all development' },
    { dependency: 'Legacy System APIs', status: 'Required', notes: 'API documentation for ERP/CRM integration. Test environment access. API credentials and rate limits. Data format specifications. Contact person for integration issues. Needed by Week 8. Impact if delayed: Integration features delayed (can be post-launch)' },
    { dependency: 'Compliance & Legal Approvals', status: 'Required', notes: 'SOC 2 audit scheduled and auditor assigned. GDPR compliance checklist approved. Privacy policy and terms of service finalized. Vendor contracts (Stripe, Okta) signed. Export control compliance if applicable. Needed by Week 14. Impact if delayed: Blocks production launch' },
    { dependency: 'Database Licenses (If applicable)', status: 'Required', notes: 'PostgreSQL/MongoDB Atlas enterprise subscription. Oracle/SQL Server licenses if required. High availability add-ons. Backup storage allocation. Needed by Week 2. Impact if delayed: Blocks data layer implementation' }
  ];

  constructor(
    private router: Router,
    private architectureService: ArchitectureService
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.prompt = navigation.extras.state['prompt'] || 'System Design';
      this.context = navigation.extras.state['context'] || '';
      this.attachments = navigation.extras.state['attachments'] || [];
      this.clarifications = navigation.extras.state['clarifications'] || {};
    }
  }

  ngOnInit(): void {
    this.generateDesign();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  generateDesign(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Merge clarifications into context
    let enhancedContext = this.context;
    if (Object.keys(this.clarifications).length > 0) {
      enhancedContext += `\n\n[Technical Clarifications]\n${JSON.stringify(this.clarifications, null, 2)}`;
    }
    
    this.subscription = this.architectureService.generateE2EDesign(
      this.prompt,
      enhancedContext,
      this.attachments
    ).subscribe({
      next: (response) => {
        this.designData = response;
        this.isLoading = false;
        
        // Update static content with dynamic data
        if (response.overview) {
          this.backgroundContent = response.overview;
        }
        if (response.designPoints?.length) {
          this.scopeItems = response.designPoints;
        }
        if (response.architectureDescription) {
          this.proposedSolutionContent = response.architectureDescription;
        }
      },
      error: (error) => {
        console.error('E2E design generation error:', error);
        this.errorMessage = 'Failed to generate design. Using default template.';
        this.isLoading = false;
      }
    });
  }

  // Getters for dynamic data with fallbacks
  get systemName(): string {
    return this.designData?.systemName || this.prompt;
  }

  get overview(): string {
    return this.designData?.overview || this.backgroundContent;
  }

  get designPoints(): string[] {
    return this.designData?.designPoints || this.scopeItems;
  }

  get architectureDiagram(): string {
    return this.designData?.architectureDiagram || '';
  }

  get sequenceDiagram(): string {
    return this.designData?.sequenceDiagram || '';
  }

  get erDiagram(): string {
    return this.designData?.erDiagram || '';
  }

  get deploymentDiagram(): string {
    return this.designData?.deploymentDiagram || '';
  }

  get apis(): APIEndpoint[] {
    return this.designData?.apis || [];
  }

  get databaseSchema(): DatabaseTable[] {
    return this.designData?.databaseSchema || [];
  }

  get devopsRecommendations(): string[] {
    return this.designData?.devopsRecommendations || [];
  }

  get securityConsiderations(): string[] {
    return this.designData?.securityConsiderations || [];
  }

  get scalabilityNotes(): string[] {
    return this.designData?.scalabilityNotes || [];
  }

  get techStackData(): { [key: string]: string[] } {
    return this.designData?.techStack || {};
  }

  get techStackKeys(): string[] {
    return Object.keys(this.techStackData);
  }

  // Proposed Solution structured getters
  get solutionOverview(): string {
    return this.designData?.overview || 'The proposed solution leverages a microservices architecture deployed on Kubernetes clusters across multiple availability zones for high availability and fault tolerance.';
  }

  get keyServices(): { name: string; description: string }[] {
    if (this.designData?.architectureDescription) {
      // Parse services from architectureDescription
      return this.parseServicesFromDescription(this.designData.architectureDescription);
    }
    // Default services
    return [
      { name: 'User Service', description: 'Manages all user-related operations' },
      { name: 'Auth Service', description: 'Handles authentication and authorization' },
      { name: 'API Gateway', description: 'Central entry point for all client requests' }
    ];
  }

  get communicationPatterns(): { type: string; description: string }[] {
    return [
      { type: 'Synchronous', description: 'REST APIs via API Gateway for client-facing operations' },
      { type: 'Asynchronous', description: 'Apache Kafka/RabbitMQ for inter-service events' },
      { type: 'Real-time', description: 'WebSocket connections for live updates' }
    ];
  }

  get dataLayerComponents(): { name: string; purpose: string }[] {
    return [
      { name: 'Primary Database', purpose: 'PostgreSQL for transactional data' },
      { name: 'Caching Layer', purpose: 'Redis for session management and frequently accessed data' },
      { name: 'Search Engine', purpose: 'Elasticsearch for full-text search capabilities' },
      { name: 'Object Storage', purpose: 'S3-compatible storage for files and media' }
    ];
  }

  get infrastructureComponents(): { name: string; purpose: string }[] {
    return [
      { name: 'Container Orchestration', purpose: 'Kubernetes for service deployment and scaling' },
      { name: 'Service Mesh', purpose: 'Istio for secure service-to-service communication' },
      { name: 'API Gateway', purpose: 'Kong/AWS API Gateway for request routing and rate limiting' },
      { name: 'Load Balancer', purpose: 'NGINX/AWS ALB for traffic distribution' }
    ];
  }

  private parseServicesFromDescription(description: string): { name: string; description: string }[] {
    const services: { name: string; description: string }[] = [];
    // Match patterns like **ServiceName**: description or - **ServiceName**: description
    const serviceRegex = /\*\*([^*]+Service)\*\*:?\s*([^*\n-]+)/g;
    let match;
    while ((match = serviceRegex.exec(description)) !== null) {
      services.push({
        name: match[1].trim(),
        description: match[2].trim()
      });
    }
    return services.length > 0 ? services : [
      { name: 'User Service', description: 'Manages all user-related operations' },
      { name: 'Auth Service', description: 'Handles authentication and authorization' },
      { name: 'API Gateway', description: 'Central entry point for all client requests' }
    ];
  }

  downloadBlueprint(): void {
    const element = document.createElement('a');
    const content = this.generateMarkdownContent();
    const file = new Blob([content], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${this.systemName.replace(/\s+/g, '-')}-blueprint.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  regenerateBlueprint(): void {
    this.generateDesign();
  }

  private generateMarkdownContent(): string {
    let markdown = `# ${this.systemName}\n\n`;
    markdown += `## Proposed Solution\n\n${this.solutionOverview}\n\n`;
    
    if (this.keyServices.length > 0) {
      markdown += `### Key Services\n\n`;
      this.keyServices.forEach(service => {
        markdown += `- **${service.name}**: ${service.description}\n`;
      });
      markdown += '\n';
    }
    
    if (this.architectureDiagram) {
      markdown += `## Architecture Diagram\n\n\`\`\`mermaid\n${this.architectureDiagram}\n\`\`\`\n\n`;
    }
    
    if (this.apis.length > 0) {
      markdown += `## API Endpoints\n\n`;
      this.apis.forEach(api => {
        markdown += `### ${api.method} ${api.path}\n`;
        markdown += `**Description**: ${api.description}\n\n`;
      });
    }
    
    if (this.databaseSchema.length > 0) {
      markdown += `## Database Schema\n\n`;
      this.databaseSchema.forEach(table => {
        markdown += `### ${table.name}\n`;
        markdown += `**Description**: ${table.description}\n\n`;
        markdown += `**Columns**:\n`;
        table.columns.forEach(col => {
          markdown += `- ${col.name} (${col.type})${col.constraints ? ' - ' + col.constraints : ''}\n`;
        });
        markdown += '\n';
      });
    }
    
    return markdown;
  }
}
