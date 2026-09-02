import { createContext, useContext, useState, type ReactNode } from 'react';

const TOKEN_KEY = 'cs_token';
const USER_KEY = 'cs_user';

type User = { email: string; name: string };
type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  });
  const [loading] = useState(false);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '로그인에 실패했습니다.');
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  };
  const logout = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider가 필요합니다.');
  return v;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** 인증 토큰을 자동으로 포함하는 fetch 헬퍼 - Universe의 apiFetch와 같은 역할을 합니다. */
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) },
  });
  if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); window.location.reload(); throw new Error('인증이 만료되었습니다.'); }
  const data = await res.json() as T & { error?: string; code?: string };
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? res.statusText) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = (data as { code?: string }).code;
    throw err;
  }
  return data;
}
