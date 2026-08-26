import { apiFetch } from '../../context/AuthContext';

export type AssetType = 'image' | 'video' | 'document';
export type ContentAsset = { id: string; advertiserId: string | null; advertiserName?: string | null; assetType: AssetType; name: string; url: string | null; tags: string[]; memo?: string | null; createdAt: string };

export const assetsApi = {
  list: (assetType: AssetType) => apiFetch<ContentAsset[]>(`/api/assets?type=${assetType}`),
  create: (body: { assetType: AssetType; name: string; url?: string; advertiserId?: string; tags?: string[]; memo?: string }) => apiFetch<ContentAsset>('/api/assets', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<{ ok: boolean }>(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
