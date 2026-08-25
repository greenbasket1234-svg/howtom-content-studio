import { apiFetch } from '../../context/AuthContext';
import type { BlogAsset, BlogProject, BlogStyleProfile } from './blogTypes';

export const blogApi = {
  projects: () => apiFetch<BlogProject[]>('/api/blog/projects'),
  getProject: (id: string) => apiFetch<BlogProject>(`/api/blog/projects/${encodeURIComponent(id)}`),
  createProject: (body: Partial<BlogProject>) => apiFetch<BlogProject>('/api/blog/projects', { method: 'POST', body: JSON.stringify(body) }),
  patchProject: (id: string, body: Partial<BlogProject> & { unlockForRevision?: boolean }) => apiFetch<BlogProject>(`/api/blog/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => apiFetch<{ ok: boolean }>(`/api/blog/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  generate: (body: Partial<BlogProject>) => apiFetch<{ generator: string; aiError?: string; titles: string[]; blocks: BlogProject['blocks'] }>('/api/blog/generate', { method: 'POST', body: JSON.stringify(body) }),
  aiStatus: () => apiFetch<{ configured: boolean; provider: string | null }>('/api/blog/ai-status'),
  style: (advertiserId: string) => apiFetch<BlogStyleProfile>(`/api/blog/styles/${encodeURIComponent(advertiserId)}`),
  saveStyle: (advertiserId: string, body: BlogStyleProfile) => apiFetch<BlogStyleProfile>(`/api/blog/styles/${encodeURIComponent(advertiserId)}`, { method: 'PUT', body: JSON.stringify(body) }),
  assets: () => apiFetch<BlogAsset[]>('/api/blog/assets'),
  addAsset: (body: Partial<BlogAsset>) => apiFetch<BlogAsset>('/api/blog/assets', { method: 'POST', body: JSON.stringify(body) }),
};
