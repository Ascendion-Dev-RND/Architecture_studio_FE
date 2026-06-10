import { Injectable } from '@angular/core';

/**
 * Sample diagram data interface
 */
export interface DiagramSample {
  type: string;
  name: string;
  data: any;
}

/**
 * DiagramSampleService - DEPRECATED
 *
 * All sample / fallback diagrams have been removed.
 * Diagram data must come from the backend API.
 */
@Injectable({
  providedIn: 'root'
})
export class DiagramSampleService {}
