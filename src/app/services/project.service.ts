import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  tags: string[];
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  tags?: string[];
  metadata?: any;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: string;
  tags?: string[];
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private readonly baseUrl: string;

  constructor(private http: HttpClient) {
    const archUrl = (environment.api as any).architectureServiceUrl;
    this.baseUrl = archUrl === '' ? '/arch' : (archUrl || 'http://localhost:8084');
  }

  createProject(request: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>(`${this.baseUrl}/api/v1/projects`, request);
  }

  listProjects(status: string = 'active'): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.baseUrl}/api/v1/projects?status=${status}`);
  }

  getProject(projectId: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/api/v1/projects/${projectId}`);
  }

  updateProject(projectId: string, request: UpdateProjectRequest): Observable<Project> {
    return this.http.put<Project>(`${this.baseUrl}/api/v1/projects/${projectId}`, request);
  }

  deleteProject(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/v1/projects/${projectId}`);
  }
}
