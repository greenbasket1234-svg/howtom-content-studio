import { apiFetch } from '../../context/AuthContext';
import type { VideoScriptProject } from './videoScriptTypes';

export const videoScriptApi = {
  projects: () => apiFetch<VideoScriptProject[]>('/api/video-scripts'),
  getProject: (id: string) => apiFetch<VideoScriptProject>(`/api/video-scripts/${encodeURIComponent(id)}`),
  createProject: (body: Partial<VideoScriptProject>) => apiFetch<VideoScriptProject>('/api/video-scripts', { method: 'POST', body: JSON.stringify(body) }),
  patchProject: (id: string, body: Partial<VideoScriptProject>) => apiFetch<VideoScriptProject>(`/api/video-scripts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => apiFetch<{ ok: boolean }>(`/api/video-scripts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
