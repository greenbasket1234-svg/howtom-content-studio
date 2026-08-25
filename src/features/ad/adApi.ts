import { apiFetch } from '../../context/AuthContext';
import type { AdProject } from './adTypes';

export const adApi = {
  projects: () => apiFetch<AdProject[]>('/api/ad/projects'),
  getProject: (id: string) => apiFetch<AdProject>(`/api/ad/projects/${encodeURIComponent(id)}`),
  createProject: (body: Partial<AdProject>) => apiFetch<AdProject>('/api/ad/projects', { method: 'POST', body: JSON.stringify(body) }),
  patchProject: (id: string, body: Partial<AdProject>) => apiFetch<AdProject>(`/api/ad/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => apiFetch<{ ok: boolean }>(`/api/ad/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
