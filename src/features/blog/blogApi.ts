import { apiFetch } from '../../context/AuthContext';
import type { BlogAsset, BlogProject, BlogStyleProfile } from './blogTypes';

export type AutopostSeat = { id: string; plan: 'trial' | 'paid'; trial_remaining?: number; status: 'active' | 'suspended' };
export class OverageConfirmRequiredError extends Error {}

export const blogApi = {
  projects: () => apiFetch<BlogProject[]>('/api/blog/projects'),
  getProject: (id: string) => apiFetch<BlogProject>(`/api/blog/projects/${encodeURIComponent(id)}`),
  createProject: (body: Partial<BlogProject>) => apiFetch<BlogProject>('/api/blog/projects', { method: 'POST', body: JSON.stringify(body) }),
  patchProject: (id: string, body: Partial<BlogProject> & { unlockForRevision?: boolean }) => apiFetch<BlogProject>(`/api/blog/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => apiFetch<{ ok: boolean }>(`/api/blog/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  async generate(body: Partial<BlogProject> & { confirmOverage?: boolean; idempotencyKey?: string }) {
    try {
      return await apiFetch<{ generator: string; aiError?: string; titles: string[]; blocks: BlogProject['blocks']; billing?: unknown }>('/api/blog/generate', { method: 'POST', body: JSON.stringify(body) });
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code === 'overage_confirm_required') throw new OverageConfirmRequiredError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  },
  aiStatus: () => apiFetch<{ configured: boolean; provider: string | null }>('/api/blog/ai-status'),
  autopostProSeat: (advertiserId: string) => apiFetch<AutopostSeat>(`/api/blog/autopost-pro/seat?advertiserId=${encodeURIComponent(advertiserId)}`),
  style: (advertiserId: string) => apiFetch<BlogStyleProfile>(`/api/blog/styles/${encodeURIComponent(advertiserId)}`),
  saveStyle: (advertiserId: string, body: BlogStyleProfile) => apiFetch<BlogStyleProfile>(`/api/blog/styles/${encodeURIComponent(advertiserId)}`, { method: 'PUT', body: JSON.stringify(body) }),
  assets: () => apiFetch<BlogAsset[]>('/api/blog/assets'),
  addAsset: (body: Partial<BlogAsset>) => apiFetch<BlogAsset>('/api/blog/assets', { method: 'POST', body: JSON.stringify(body) }),
};
