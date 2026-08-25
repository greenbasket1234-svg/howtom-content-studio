import { apiFetch } from '../../context/AuthContext';
import type { BlogProject } from './blogTypes';

export const blogApi = {
  projects: () => apiFetch<BlogProject[]>('/api/blog/projects'),
  getProject: (id: string) => apiFetch<BlogProject>(`/api/blog/projects/${encodeURIComponent(id)}`),
  createProject: (body: Partial<BlogProject>) => apiFetch<BlogProject>('/api/blog/projects', { method: 'POST', body: JSON.stringify(body) }),
  patchProject: (id: string, body: Partial<BlogProject>) => apiFetch<BlogProject>(`/api/blog/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => apiFetch<void>(`/api/blog/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  generate: (body: Partial<BlogProject>) => apiFetch<{ generator: string; titles: string[]; blocks: BlogProject['blocks'] }>('/api/blog/generate', { method: 'POST', body: JSON.stringify(body) }),
  aiStatus: () => apiFetch<{ configured: boolean; provider: string | null }>('/api/blog/ai-status'),
};
