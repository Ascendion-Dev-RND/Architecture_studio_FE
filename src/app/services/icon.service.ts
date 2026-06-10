import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { from, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface IconMetadata {
  iconId: string;
  provider: string;
  serviceName: string;
  displayName: string;
  category: string;
  imageUrl: string;
  width: number;
  height: number;
  tags: string[];
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class IconService {
  private readonly apiUrl = `${(environment.api as any).iconServiceUrl || environment.api.backendUrl || ''}/api/icons`;
  private iconCache = new Map<string, IconMetadata>();
  private resolvedIconUrlCache = new Map<string, string>();
  private allIconsCache$?: Observable<IconMetadata[]>;

  constructor(private http: HttpClient) {}

  /**
   * Get all icons, optionally filtered by provider.
   * Results are cached.
   */
  listIcons(provider?: string): Observable<IconMetadata[]> {
    const cacheKey = provider || 'all';
    
    if (!this.allIconsCache$ || provider) {
      let params = new HttpParams();
      if (provider) {
        params = params.set('provider', provider);
      }

      const request$ = this.http.get<IconMetadata[]>(this.apiUrl, { params }).pipe(
        map(icons => {
          icons.forEach(icon => this.iconCache.set(icon.iconId.toLowerCase(), icon));
          return icons;
        }),
        shareReplay(1),
        catchError(error => {
          console.error('Error fetching icons:', error);
          return of([]);
        })
      );

      if (!provider) {
        this.allIconsCache$ = request$;
      }
      
      return request$;
    }

    return this.allIconsCache$;
  }

  /**
   * Search icons by query.
   */
  searchIcons(query: string, provider?: string): Observable<IconMetadata[]> {
    let params = new HttpParams().set('q', query);
    if (provider) {
      params = params.set('provider', provider);
    }

    return this.http.get<IconMetadata[]>(`${this.apiUrl}/search`, { params }).pipe(
      catchError(error => {
        console.error('Error searching icons:', error);
        return of([]);
      })
    );
  }

  /**
   * Get a specific icon by ID.
   * Checks cache first, then calls API.
   */
  getIcon(iconId: string): Observable<IconMetadata | null> {
    const normalizedId = iconId.toLowerCase();
    
    // Check cache first
    if (this.iconCache.has(normalizedId)) {
      return of(this.iconCache.get(normalizedId)!);
    }

    return this.http.get<IconMetadata>(`${this.apiUrl}/${iconId}`).pipe(
      map(icon => {
        this.iconCache.set(normalizedId, icon);
        return icon;
      }),
      catchError(error => {
        console.warn(`Icon not found: ${iconId}`, error);
        return of(null);
      })
    );
  }

  /**
   * Get icon URL by iconId.
   * Returns the SVG URL from the backend, a keyword-matched fallback, or a generic SVG.
   */
  getIconUrl(iconId: string): Observable<string> {
    const normalizedId = (iconId || '').toLowerCase();
    if (this.resolvedIconUrlCache.has(normalizedId)) {
      return of(this.resolvedIconUrlCache.get(normalizedId)!);
    }

    return this.getIcon(iconId).pipe(
      switchMap(icon => from(this.resolveSafeIconUrl(iconId, icon?.imageUrl))),
      map(url => {
        this.resolvedIconUrlCache.set(normalizedId, url);
        return url;
      })
    );
  }

  /**
   * Keyword-based fallback icon resolver.
   * Maps common service keywords to known good SVG URLs so icons never show blank.
   */
  private getFallbackIconUrl(iconId: string): string {
    const id = (iconId || '').toLowerCase();
    const provider = this.detectProvider(id);

    const fallbackMap: Record<string, string> = {
      'database': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'rds': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'aurora': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'dynamodb': 'https://icons.terrastruct.com/essentials/112-server.svg',
      's3': 'https://icons.terrastruct.com/essentials/074-folder.svg',
      'storage': 'https://icons.terrastruct.com/essentials/074-folder.svg',
      'lambda': 'https://icons.terrastruct.com/essentials/073-lightning.svg',
      'compute': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'ec2': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'ecs': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'eks': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'fargate': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'api-gateway': 'https://icons.terrastruct.com/essentials/050-globe.svg',
      'gateway': 'https://icons.terrastruct.com/essentials/050-globe.svg',
      'cloudfront': 'https://icons.terrastruct.com/essentials/050-globe.svg',
      'cdn': 'https://icons.terrastruct.com/essentials/050-globe.svg',
      'route53': 'https://icons.terrastruct.com/essentials/050-globe.svg',
      'elb': 'https://icons.terrastruct.com/essentials/050-globe.svg',
      'alb': 'https://icons.terrastruct.com/essentials/050-globe.svg',
      'load-balancer': 'https://icons.terrastruct.com/essentials/050-globe.svg',
      'sqs': 'https://icons.terrastruct.com/essentials/061-mail.svg',
      'sns': 'https://icons.terrastruct.com/essentials/061-mail.svg',
      'queue': 'https://icons.terrastruct.com/essentials/061-mail.svg',
      'waf': 'https://icons.terrastruct.com/essentials/127-lock.svg',
      'shield': 'https://icons.terrastruct.com/essentials/127-lock.svg',
      'cognito': 'https://icons.terrastruct.com/essentials/127-lock.svg',
      'iam': 'https://icons.terrastruct.com/essentials/127-lock.svg',
      'cloudwatch': 'https://icons.terrastruct.com/essentials/085-eye.svg',
      'monitor': 'https://icons.terrastruct.com/essentials/085-eye.svg',
      'elasticache': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'redis': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'cache': 'https://icons.terrastruct.com/essentials/112-server.svg',
      'kinesis': 'https://icons.terrastruct.com/essentials/061-mail.svg',
      'vpc': 'https://icons.terrastruct.com/essentials/092-network.svg',
      'nat': 'https://icons.terrastruct.com/essentials/092-network.svg',
      'client': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/user.svg',
      'internet': 'https://icons.terrastruct.com/essentials/050-globe.svg',
      // ── Abstract architecture ────────────────────────────────────
      'user': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/user.svg',
      'generic-user': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/user.svg',
      'end-user': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/user.svg',
      'actor': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/user.svg',
      'web-app': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/googlechrome.svg',
      'mobile-app': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/android.svg',
      'mobile': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/android.svg',
      'microservice': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/spring.svg',
      // ── OSS / neutral tools ──────────────────────────────────────
      'github': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/github.svg',
      'gitlab': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/gitlab.svg',
      'bitbucket': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/bitbucket.svg',
      'git': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/git.svg',
      'jenkins': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/jenkins.svg',
      'argocd': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/argo.svg',
      'terraform': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/terraform.svg',
      'ansible': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/ansible.svg',
      'docker': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/docker.svg',
      'kubernetes': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/kubernetes.svg',
      'openshift': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/redhatopenshift.svg',
      'kafka': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/apachekafka.svg',
      'mq': 'https://icons.terrastruct.com/essentials/061-mail.svg',
      'grafana': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/grafana.svg',
      'prometheus': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/prometheus.svg',
      'elasticsearch': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/elasticsearch.svg',
      'kibana': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/kibana.svg',
      'opensearch': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/opensearch.svg',
      'datadog': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/datadog.svg',
      'splunk': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/splunk.svg',
      'newrelic': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/newrelic.svg',
      'jaeger': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/jaeger.svg',
      'nginx': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/nginx.svg',
      'apache-http-server': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/apache.svg',
      'istio': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/istio.svg',
      'linkerd': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/linkerd.svg',
      'vault': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/vault.svg',
      'consul': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/consul.svg',
      'sonarqube': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/sonarqube.svg',
      'snyk': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/snyk.svg',
      'trivy': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/trivy.svg',
      // ── AWS additions ────────────────────────────────────────────
      'aws-mq': 'https://icons.terrastruct.com/aws/Application%20Integration/Amazon-MQ.svg',
      'aws-opensearch': 'https://icons.terrastruct.com/aws/Analytics/Amazon-OpenSearch-Service.svg',
      'aws-managed-grafana': 'https://icons.terrastruct.com/aws/Analytics/Amazon-Managed-Grafana.svg',
      'aws-managed-prometheus': 'https://icons.terrastruct.com/aws/Analytics/Amazon-Managed-Service-for-Prometheus.svg',
    };

    // Per-service Azure icons. Each service gets its own CDN-hosted SVG so
    // Application Gateway, SQL, Cosmos, Service Bus, Key Vault etc. are
    // visually distinct (matches Microsoft's reference-architecture style).
    // Broken URLs gracefully fall back to the generic Azure badge via
    // resolveSafeIconUrl.canLoadImage — so there is no regression risk if a
    // single CDN entry fails.
    const azureFallbackMap: Record<string, string> = {
      // ── Identity ───────────────────────────────────────────────
      'azure-ad': 'https://icons.terrastruct.com/azure/Identity%20Service%20Color/Azure%20Active%20Directory.svg',
      'microsoft-entra-id': 'https://icons.terrastruct.com/azure/Identity%20Service%20Color/Azure%20Active%20Directory.svg',
      'azure-active-directory': 'https://icons.terrastruct.com/azure/Identity%20Service%20Color/Azure%20Active%20Directory.svg',
      // ── Compute ────────────────────────────────────────────────
      'azure-aks': 'https://icons.terrastruct.com/azure/Compute%20Service%20Color/Kubernetes%20Services.svg',
      'azure-kubernetes-service': 'https://icons.terrastruct.com/azure/Compute%20Service%20Color/Kubernetes%20Services.svg',
      'azure-app-service': 'https://icons.terrastruct.com/azure/App%20Services%20Color/App%20Services.svg',
      'azure-functions': 'https://icons.terrastruct.com/azure/Compute%20Service%20Color/Function%20Apps.svg',
      'azure-logic-apps': 'https://icons.terrastruct.com/azure/Integration%20Service%20Color/Logic%20Apps.svg',
      'azure-container-apps': 'https://icons.terrastruct.com/azure/Containers%20Service%20Color/Container%20Apps%20Environments.svg',
      'azure-container-instances': 'https://icons.terrastruct.com/azure/Containers%20Service%20Color/Container%20Instances.svg',
      'azure-service-fabric': 'https://icons.terrastruct.com/azure/Compute%20Service%20Color/Service%20Fabric%20Clusters.svg',
      'azure-vm': 'https://icons.terrastruct.com/azure/Compute%20Service%20Color/Virtual%20Machine.svg',
      'azure-virtual-machines': 'https://icons.terrastruct.com/azure/Compute%20Service%20Color/Virtual%20Machine.svg',
      'azure-batch': 'https://icons.terrastruct.com/azure/Compute%20Service%20Color/Batch%20Accounts.svg',
      // ── Ingress / Edge ────────────────────────────────────────
      'azure-front-door': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Front%20Doors.svg',
      'azure-application-gateway': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Application%20Gateways.svg',
      'azure-app-gateway': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Application%20Gateways.svg',
      'azure-api-management': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/API%20Management%20Services.svg',
      'azure-waf': 'https://icons.terrastruct.com/azure/Security%20Service%20Color/Application%20Security%20Groups.svg',
      'azure-cdn': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/CDN%20Profiles.svg',
      'azure-traffic-manager': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Traffic%20Manager%20Profiles.svg',
      'azure-dns': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/DNS%20Zones.svg',
      'azure-vnet': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Virtual%20Networks.svg',
      'azure-load-balancer': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Load%20Balancers.svg',
      'azure-private-endpoint': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Private%20Link%20Services.svg',
      'azure-private-link': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Private%20Link%20Services.svg',
      'azure-nsg': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Network%20Security%20Groups.svg',
      'azure-network-security-group': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Network%20Security%20Groups.svg',
      'azure-firewall': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/Firewalls.svg',
      'azure-nat-gateway': 'https://icons.terrastruct.com/azure/Networking%20Service%20Color/NAT.svg',
      // ── Messaging / Events ────────────────────────────────────
      'azure-service-bus': 'https://icons.terrastruct.com/azure/Integration%20Service%20Color/Service%20Bus.svg',
      'azure-event-grid': 'https://icons.terrastruct.com/azure/Integration%20Service%20Color/Event%20Grid%20Subscriptions.svg',
      'azure-event-hubs': 'https://icons.terrastruct.com/azure/Integration%20Service%20Color/Event%20Hubs.svg',
      'azure-event-hub': 'https://icons.terrastruct.com/azure/Integration%20Service%20Color/Event%20Hubs.svg',
      'azure-notification-hubs': 'https://icons.terrastruct.com/azure/Mobile%20Service%20Color/Notification%20Hubs.svg',
      'azure-queue-storage': 'https://icons.terrastruct.com/azure/Storage%20Service%20Color/Queues%20Storage.svg',
      // ── Data ──────────────────────────────────────────────────
      'azure-sql': 'https://icons.terrastruct.com/azure/Database%20Service%20Color/SQL%20Database.svg',
      'azure-sql-database': 'https://icons.terrastruct.com/azure/Database%20Service%20Color/SQL%20Database.svg',
      'azure-cosmos': 'https://icons.terrastruct.com/azure/Database%20Service%20Color/Azure%20Cosmos%20DB.svg',
      'azure-cosmos-db': 'https://icons.terrastruct.com/azure/Database%20Service%20Color/Azure%20Cosmos%20DB.svg',
      'azure-postgres': 'https://icons.terrastruct.com/azure/Database%20Service%20Color/Azure%20Database%20PostgreSQL%20Server.svg',
      'azure-mysql': 'https://icons.terrastruct.com/azure/Database%20Service%20Color/Azure%20Database%20MySQL%20Server.svg',
      'azure-cache-redis': 'https://icons.terrastruct.com/azure/Database%20Service%20Color/Cache%20Redis.svg',
      'azure-redis': 'https://icons.terrastruct.com/azure/Database%20Service%20Color/Cache%20Redis.svg',
      'azure-synapse': 'https://icons.terrastruct.com/azure/Analytics%20Service%20Color/Azure%20Synapse%20Analytics.svg',
      'azure-databricks': 'https://icons.terrastruct.com/azure/Analytics%20Service%20Color/Azure%20Databricks.svg',
      'azure-blob': 'https://icons.terrastruct.com/azure/Storage%20Service%20Color/Storage%20Accounts.svg',
      'azure-blob-storage': 'https://icons.terrastruct.com/azure/Storage%20Service%20Color/Storage%20Accounts.svg',
      'azure-data-lake': 'https://icons.terrastruct.com/azure/Storage%20Service%20Color/Data%20Lake%20Storage%20Gen1.svg',
      'azure-files': 'https://icons.terrastruct.com/azure/Storage%20Service%20Color/Azure%20File%20Sync%20Service.svg',
      // ── Security / Ops ────────────────────────────────────────
      'azure-key-vault': 'https://icons.terrastruct.com/azure/Security%20Service%20Color/Key%20Vaults.svg',
      'azure-monitor': 'https://icons.terrastruct.com/azure/Management%20+%20Governance%20Service%20Color/Monitor.svg',
      'azure-log-analytics': 'https://icons.terrastruct.com/azure/Management%20+%20Governance%20Service%20Color/Log%20Analytics%20Workspaces.svg',
      'azure-app-insights': 'https://icons.terrastruct.com/azure/DevOps%20Service%20Color/Application%20Insights.svg',
      'azure-application-insights': 'https://icons.terrastruct.com/azure/DevOps%20Service%20Color/Application%20Insights.svg',
      'azure-defender': 'https://icons.terrastruct.com/azure/Security%20Service%20Color/Defender%20CM%20Jobs.svg',
      'azure-sentinel': 'https://icons.terrastruct.com/azure/Security%20Service%20Color/Microsoft%20Sentinel.svg',
      'azure-acr': 'https://icons.terrastruct.com/azure/Containers%20Service%20Color/Container%20Registries.svg',
      'azure-container-registry': 'https://icons.terrastruct.com/azure/Containers%20Service%20Color/Container%20Registries.svg',
      'azure-devops': 'https://icons.terrastruct.com/azure/DevOps%20Service%20Color/Azure%20DevOps.svg',
    };

    const gcpFallbackMap: Record<string, string> = {
      'gcp-compute-engine': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Compute/Compute%20Engine.svg',
      'gcp-cloud-functions': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Compute/Cloud%20Functions.svg',
      'gcp-gke': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Compute/Kubernetes%20Engine.svg',
      'gcp-cloud-run': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Compute/Cloud%20Run.svg',
      'gcp-cloud-sql': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Databases/Cloud%20SQL.svg',
      'gcp-cloud-storage': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Storage/Cloud%20Storage.svg',
      'gcp-vpc': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Networking/Virtual%20Private%20Cloud.svg',
      'gcp-load-balancing': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Networking/Cloud%20Load%20Balancing.svg',
      'gcp-cloud-cdn': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Networking/Cloud%20CDN.svg',
      'gcp-pub-sub': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Data%20Analytics/Cloud%20Pub%20Sub.svg',
      'gcp-iam': 'https://icons.terrastruct.com/gcp/Products%20and%20services/Security/Cloud%20IAM.svg',
    };

    const providerSpecificMap = provider === 'azure' ? azureFallbackMap : provider === 'gcp' ? gcpFallbackMap : fallbackMap;

    if (providerSpecificMap[id]) return providerSpecificMap[id];

    // Exact match
    if (fallbackMap[id]) return fallbackMap[id];

    // Substring match
    for (const [key, url] of Object.entries(providerSpecificMap)) {
      if (id.includes(key)) return url;
    }
    for (const [key, url] of Object.entries(fallbackMap)) {
      if (id.includes(key)) return url;
    }

    // Ultimate fallback: generic server icon (always available)
    return this.getProviderFallbackUrl(provider);
  }

  private detectProvider(iconId: string): 'aws' | 'azure' | 'gcp' | 'generic' {
    if (iconId.startsWith('aws-')) return 'aws';
    if (iconId.startsWith('azure-')) return 'azure';
    if (iconId.startsWith('gcp-')) return 'gcp';
    return 'generic';
  }

  private async resolveSafeIconUrl(iconId: string, candidateUrl?: string): Promise<string> {
    const provider = this.detectProvider((iconId || '').toLowerCase());
    const fallbackUrl = this.getFallbackIconUrl(iconId);
    const guaranteedFallbackUrl = this.getProviderFallbackUrl(provider);

    if (candidateUrl?.trim() && await this.canLoadImage(candidateUrl)) {
      return candidateUrl;
    }
    if (fallbackUrl?.trim() && await this.canLoadImage(fallbackUrl)) {
      return fallbackUrl;
    }
    return guaranteedFallbackUrl;
  }

  private canLoadImage(url: string): Promise<boolean> {
    const normalizedUrl = (url || '').trim();
    if (!normalizedUrl) {
      return Promise.resolve(false);
    }
    if (normalizedUrl.startsWith('data:image/')) {
      return Promise.resolve(true);
    }

    return new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          image.onload = null;
          image.onerror = null;
          resolve(false);
        }
      }, 4000);

      image.onload = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(true);
        }
      };
      image.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(false);
        }
      };
      image.referrerPolicy = 'no-referrer';
      image.src = normalizedUrl;
    });
  }

  private getProviderFallbackUrl(provider: 'aws' | 'azure' | 'gcp' | 'generic'): string {
    switch (provider) {
      case 'aws':
        return this.AWS_FALLBACK_SVG;
      case 'azure':
        return this.AZURE_FALLBACK_SVG;
      case 'gcp':
        return this.GCP_FALLBACK_SVG;
      default:
        return this.GENERIC_FALLBACK_SVG;
    }
  }

  /** Data-URI generic cloud service icon — guaranteed to never be blank */
  private readonly GENERIC_FALLBACK_SVG = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%236366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>'
  )}`;
  private readonly AWS_FALLBACK_SVG = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="6" y="10" width="52" height="44" rx="12" fill="%23FF9900"/><text x="32" y="38" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="700" fill="white">AWS</text></svg>'
  )}`;
  private readonly AZURE_FALLBACK_SVG = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="6" y="10" width="52" height="44" rx="12" fill="%230078D4"/><text x="32" y="38" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="17" font-weight="700" fill="white">AZ</text></svg>'
  )}`;
  private readonly GCP_FALLBACK_SVG = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="6" y="10" width="52" height="44" rx="12" fill="%234285F4"/><text x="32" y="38" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="16" font-weight="700" fill="white">GCP</text></svg>'
  )}`;

  /**
   * Prefetch all AWS icons on service initialization.
   */
  prefetchAwsIcons(): void {
    this.listIcons('aws').subscribe();
  }
}
