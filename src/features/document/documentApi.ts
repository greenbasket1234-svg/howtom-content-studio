import { apiFetch } from '../../context/AuthContext';
import type { DocumentProject } from './documentTypes';

export const documentApi = {
  projects: () => apiFetch<DocumentProject[]>('/api/documents'),
  getProject: (id: string) => apiFetch<DocumentProject>(`/api/documents/${encodeURIComponent(id)}`),
  createProject: (body: Partial<DocumentProject>) => apiFetch<DocumentProject>('/api/documents', { method: 'POST', body: JSON.stringify(body) }),
  patchProject: (id: string, body: Partial<DocumentProject>) => apiFetch<DocumentProject>(`/api/documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => apiFetch<{ ok: boolean }>(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
