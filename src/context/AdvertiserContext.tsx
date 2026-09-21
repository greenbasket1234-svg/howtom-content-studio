import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from './AuthContext';

export type Advertiser = { id: string; name: string; industry?: string; website?: string; phone?: string; address?: string; business_reg_no?: string | null; autopost_pro_industry?: string | null };
export const ALL_ADVERTISERS_ID = '__all__';

type Value = {
  advertisers: Advertiser[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  selected: Advertiser | null;
  isAllSelected: boolean;
  isAdvertiserAccount: boolean; // 광고주 계정 여부
  selectedAdvertiserIds: string[];
  selectedLabel: string;
  loading: boolean;
};

const Ctx = createContext<Value | null>(null);
const STORAGE_KEY = 'cs_selected_advertiser';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('cs_user') || 'null'); } catch { return null; }
}

export function AdvertiserProvider({ children }: { children: ReactNode }) {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [selectedId, setSelectedIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || ALL_ADVERTISERS_ID);
  const [loading, setLoading] = useState(true);

  // 광고주 계정인지 확인
  const storedUser = getStoredUser();
  const isAdvertiserAccount = Boolean(storedUser?.isAdvertiserAccount);
  const fixedAdvertiserId = storedUser?.advertiserId || null;

  useEffect(() => {
    apiFetch<Advertiser[]>('/api/advertisers')
      .then(list => {
        const next = list || [];

        if (isAdvertiserAccount && fixedAdvertiserId) {
          // 광고주 계정: 본인 광고주만 표시하고 자동 고정합니다.
          const mine = next.filter(a => a.id === fixedAdvertiserId);
          setAdvertisers(mine);
          setSelectedIdState(fixedAdvertiserId);
          localStorage.setItem(STORAGE_KEY, fixedAdvertiserId);
        } else {
          setAdvertisers(next);
          // 저장된 광고주가 삭제되었거나 접근 불가능하면 전체 보기로 복귀합니다.
          if (selectedId !== ALL_ADVERTISERS_ID && !next.some(a => a.id === selectedId)) {
            setSelectedIdState(ALL_ADVERTISERS_ID);
            localStorage.setItem(STORAGE_KEY, ALL_ADVERTISERS_ID);
          }
        }
      })
      .catch(() => setAdvertisers([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedId = (id: string) => {
    if (isAdvertiserAccount) return; // 광고주 계정은 변경 불가
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
      isAdvertiserAccount,
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
