import { apiFetch } from '../../context/AuthContext';
import type { AutopostBilling, AutopostComplianceResult, AutopostSeat, BlogAsset, BlogProject, BlogStyleProfile } from './blogTypes';

export class OverageConfirmRequiredError extends Error {}

export type GenerateResponse = { generator: string; aiError?: string; titles: string[]; blocks: BlogProject['blocks']; billing?: AutopostBilling | null; providerDraftId?: string | null; tags?: string[]; metaDescription?: string; idempotencyKey: string; saveWarning?: string; replayed?: boolean };
export type SeatListItem = AutopostSeat & { advertiser_id: string; advertiser_name: string };

export const blogApi = {
  projects: () => apiFetch<BlogProject[]>('/api/blog/projects'),
  getProject: (id: string) => apiFetch<BlogProject>(`/api/blog/projects/${encodeURIComponent(id)}`),
  createProject: (body: Partial<BlogProject>) => apiFetch<BlogProject>('/api/blog/projects', { method: 'POST', body: JSON.stringify(body) }),
  patchProject: (id: string, body: Partial<BlogProject> & { unlockForRevision?: boolean }) => apiFetch<BlogProject>(`/api/blog/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => apiFetch<{ ok: boolean }>(`/api/blog/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  async generate(body: Partial<BlogProject> & { projectId: string; confirmOverage?: boolean; idempotencyKey: string; numImages?: number; length?: 'short' | 'medium' | 'long' | 'auto' }) {
    try {
      return await apiFetch<GenerateResponse>('/api/blog/generate', { method: 'POST', body: JSON.stringify(body) });
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code === 'overage_confirm_required') throw new OverageConfirmRequiredError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  },
  aiStatus: () => apiFetch<{ configured: boolean; provider: string | null }>('/api/blog/ai-status'),

  // 좌석: GET은 조회만(없으면 404, 새로 안 만듦), POST가 실제 생성입니다.
  getAutopostProSeat: (advertiserId: string) => apiFetch<AutopostSeat & { noSeat?: boolean }>(`/api/blog/autopost-pro/seat?advertiserId=${encodeURIComponent(advertiserId)}`),
  createAutopostProSeat: (advertiserId: string) => apiFetch<AutopostSeat>('/api/blog/autopost-pro/seat', { method: 'POST', body: JSON.stringify({ advertiserId }) }),
  suspendAutopostProSeat: (advertiserId: string) => apiFetch<AutopostSeat>('/api/blog/autopost-pro/seat/suspend', { method: 'POST', body: JSON.stringify({ advertiserId }) }),
  activateAutopostProSeat: (advertiserId: string) => apiFetch<AutopostSeat>('/api/blog/autopost-pro/seat/activate', { method: 'POST', body: JSON.stringify({ advertiserId }) }),
  listAutopostProSeats: () => apiFetch<{ items: SeatListItem[] }>('/api/blog/autopost-pro/seats').then(r => r.items),

  // 월 사용량·정산 (month 미지정 시 이번 달)
  autopostProUsage: (month?: string) => apiFetch<Record<string, unknown>>(`/api/blog/autopost-pro/usage${month ? `?month=${encodeURIComponent(month)}` : ''}`),

  // 오토포스트 Pro 업종별 규정검수 - HOWTOM 자체 사전점검(complianceEngine.ts)과는 별개입니다.
  autopostCompliance: (input: { industry: string; text: string; orgName?: string; projectId?: string }) =>
    apiFetch<AutopostComplianceResult>('/api/blog/compliance', { method: 'POST', body: JSON.stringify(input) }),

  style: (advertiserId: string) => apiFetch<BlogStyleProfile>(`/api/blog/styles/${encodeURIComponent(advertiserId)}`),
  saveStyle: (advertiserId: string, body: BlogStyleProfile) => apiFetch<BlogStyleProfile>(`/api/blog/styles/${encodeURIComponent(advertiserId)}`, { method: 'PUT', body: JSON.stringify(body) }),
  assets: () => apiFetch<BlogAsset[]>('/api/blog/assets'),
  addAsset: (body: Partial<BlogAsset>) => apiFetch<BlogAsset>('/api/blog/assets', { method: 'POST', body: JSON.stringify(body) }),
};
