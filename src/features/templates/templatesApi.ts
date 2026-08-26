import { apiFetch } from '../../context/AuthContext';
import type { ContentTemplate } from './templateTypes';

export const templatesApi = {
  list: () => apiFetch<ContentTemplate[]>('/api/templates'),
  create: (body: Partial<ContentTemplate>) => apiFetch<ContentTemplate>('/api/templates', { method: 'POST', body: JSON.stringify(body) }),
  patch: (id: string, body: Partial<ContentTemplate>) => apiFetch<ContentTemplate>(`/api/templates/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<{ ok: boolean }>(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  duplicate: (id: string) => apiFetch<ContentTemplate>(`/api/templates/${encodeURIComponent(id)}/duplicate`, { method: 'POST' }),
  newVersion: (id: string) => apiFetch<ContentTemplate>(`/api/templates/${encodeURIComponent(id)}/new-version`, { method: 'POST' }),
};
