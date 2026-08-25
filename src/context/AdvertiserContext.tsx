import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from './AuthContext';

export type Advertiser = { id: string; name: string };
export const ALL_ADVERTISERS_ID = '__all__';

type Value = {
  advertisers: Advertiser[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  selected: Advertiser | null;
  isAllSelected: boolean;
  selectedAdvertiserIds: string[];
  selectedLabel: string;
  loading: boolean;
};

const Ctx = createContext<Value | null>(null);
const STORAGE_KEY = 'cs_selected_advertiser';

export function AdvertiserProvider({ children }: { children: ReactNode }) {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [selectedId, setSelectedIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || ALL_ADVERTISERS_ID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Advertiser[]>('/api/advertisers')
      .then(list => {
        const next = list || [];
        setAdvertisers(next);

        // 전체 보기는 광고주가 0개여도 유효한 공통 범위입니다.
        // 저장된 특정 광고주가 삭제되었거나 더 이상 접근할 수 없으면 전체 보기로 안전하게 복귀합니다.
        if (selectedId !== ALL_ADVERTISERS_ID && !next.some(a => a.id === selectedId)) {
          setSelectedIdState(ALL_ADVERTISERS_ID);
          localStorage.setItem(STORAGE_KEY, ALL_ADVERTISERS_ID);
        }
      })
      .catch(() => setAdvertisers([]))
      .finally(() => setLoading(false));
    // 최초 로드 시 저장된 선택값만 검증합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedId = (id: string) => {
    const nextId = id || ALL_ADVERTISERS_ID;
    setSelectedIdState(nextId);
    localStorage.setItem(STORAGE_KEY, nextId);
  };

  const isAllSelected = selectedId === ALL_ADVERTISERS_ID;
  const selected = isAllSelected ? null : advertisers.find(a => a.id === selectedId) || null;
  const selectedAdvertiserIds = useMemo(
    () => isAllSelected ? advertisers.map(a => a.id) : (selected ? [selected.id] : []),
    [advertisers, isAllSelected, selected],
  );
  const selectedLabel = isAllSelected ? '전체 보기' : (selected?.name || '광고주 없음');

  return (
    <Ctx.Provider value={{
      advertisers,
      selectedId,
      setSelectedId,
      selected,
      isAllSelected,
      selectedAdvertiserIds,
      selectedLabel,
      loading,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdvertiserContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AdvertiserProvider가 필요합니다.');
  return v;
}
