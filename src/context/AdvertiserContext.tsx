import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from './AuthContext';

export type Advertiser = { id: string; name: string };

type Value = {
  advertisers: Advertiser[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  selected: Advertiser | null;
  loading: boolean;
};

const Ctx = createContext<Value | null>(null);
const STORAGE_KEY = 'cs_selected_advertiser';

export function AdvertiserProvider({ children }: { children: ReactNode }) {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [selectedId, setSelectedIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Advertiser[]>('/api/advertisers')
      .then(list => {
        setAdvertisers(list || []);
        // 저장된 선택이 없거나 더 이상 존재하지 않는 광고주면, 첫 번째 광고주를 기본으로 선택합니다.
        if (list?.length && !list.some(a => a.id === selectedId)) setSelectedIdState(list[0].id);
      })
      .catch(() => setAdvertisers([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedId = (id: string) => { setSelectedIdState(id); localStorage.setItem(STORAGE_KEY, id); };
  const selected = advertisers.find(a => a.id === selectedId) || null;

  return <Ctx.Provider value={{ advertisers, selectedId, setSelectedId, selected, loading }}>{children}</Ctx.Provider>;
}

export function useAdvertiserContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AdvertiserProvider가 필요합니다.');
  return v;
}
