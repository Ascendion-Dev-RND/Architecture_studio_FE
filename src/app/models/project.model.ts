/**
 * Project Model
 * 
 * Represents an architecture project in the system.
 */
export interface Project {
  id: string;
  name: string;
  author: string;
  date: string;
  isNew?: boolean;
}

/**
 * Tab Type Definition
 */
export type TabType = 'recent' | 'all';
