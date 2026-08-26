import { apiFetch } from '../../context/AuthContext';
import type { Competitor, ReferenceAiAnalysis, ReferenceBoard, SavedReference, SearchResult } from './referenceTypes';

export const referencesApi = {
  connectorStatus: () => apiFetch<{ meta: boolean; youtube: boolean; instagram: boolean; tiktok: boolean; threads: boolean }>('/api/references/connector-status'),
  search: (body: { platform?: 'meta' | 'youtube' | 'instagram' | 'tiktok' | 'threads'; keyword?: string; pageIds?: string[]; channelId?: string; igBusinessAccountId?: string; country?: string }) => apiFetch<{ status: 'ok' | 'error'; results?: SearchResult[]; error?: string }>('/api/references/search', { method: 'POST', body: JSON.stringify(body) }),
  list: (advertiserId?: string) => apiFetch<SavedReference[]>(`/api/references${advertiserId ? `?advertiserId=${advertiserId}` : ''}`),
  save: (body: Partial<SavedReference>) => apiFetch<{ id: string }>('/api/references', { method: 'POST', body: JSON.stringify(body) }),
  patch: (id: string, body: { memo?: string; tags?: string[] }) => apiFetch<{ ok: boolean }>(`/api/references/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<{ ok: boolean }>(`/api/references/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  analyze: (id: string) => apiFetch<{ analysis: ReferenceAiAnalysis; analyzedAt: string }>(`/api/references/${encodeURIComponent(id)}/analyze`, { method: 'POST' }),

  boards: () => apiFetch<ReferenceBoard[]>('/api/reference-boards'),
  createBoard: (name: string, advertiserId?: string) => apiFetch<{ id: string; name: string }>('/api/reference-boards', { method: 'POST', body: JSON.stringify({ name, advertiserId }) }),
  renameBoard: (id: string, name: string) => apiFetch<{ ok: boolean }>(`/api/reference-boards/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteBoard: (id: string) => apiFetch<{ ok: boolean }>(`/api/reference-boards/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  boardItems: (id: string) => apiFetch<SavedReference[]>(`/api/reference-boards/${encodeURIComponent(id)}/items`),
  addToBoard: (boardId: string, referenceId: string) => apiFetch<{ ok: boolean }>(`/api/reference-boards/${encodeURIComponent(boardId)}/items`, { method: 'POST', body: JSON.stringify({ referenceId }) }),
  removeFromBoard: (boardId: string, referenceId: string) => apiFetch<{ ok: boolean }>(`/api/reference-boards/${encodeURIComponent(boardId)}/items/${encodeURIComponent(referenceId)}`, { method: 'DELETE' }),

  competitors: (advertiserId?: string) => apiFetch<Competitor[]>(`/api/reference-competitors${advertiserId ? `?advertiserId=${advertiserId}` : ''}`),
  addCompetitor: (body: { advertiserId: string; brandName: string; pageName?: string }) => apiFetch<{ id: string; brandName: string }>('/api/reference-competitors', { method: 'POST', body: JSON.stringify(body) }),
  removeCompetitor: (id: string) => apiFetch<{ ok: boolean }>(`/api/reference-competitors/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  workerStatus: () => apiFetch<{ enabled: boolean; hoursKst: number[]; lastRunAt: string | null; lastResult: { competitors: number; newCount: number; updatedCount: number; failedCount: number } | null }>('/api/references/worker-status'),
  runWorkerNow: () => apiFetch<{ ok: boolean; message: string }>('/api/references/worker-run-now', { method: 'POST' }),
};
