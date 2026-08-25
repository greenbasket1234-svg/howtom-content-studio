import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AppSwitcher } from './AppSwitcher';
import { useAuth } from '../context/AuthContext';
import { ALL_ADVERTISERS_ID, useAdvertiserContext } from '../context/AdvertiserContext';

const NAV_GROUPS: { label: string; items: { to: string; label: string }[] }[] = [
  { label: '', items: [{ to: '/', label: '홈' }] },
  { label: '레퍼런스', items: [
    { to: '/references', label: '레퍼런스 탐색' },
    { to: '/references/competitors', label: '경쟁사 모니터링' },
    { to: '/references/boards', label: '레퍼런스 보드' },
    { to: '/references/settings', label: '수집 설정' },
  ] },
  { label: '제작', items: [
    { to: '/production/ad', label: '광고 제작' },
    { to: '/production/blog', label: '블로그 제작' },
    { to: '/production/image', label: '이미지 제작' },
    { to: '/production/video-script', label: '영상 대본' },
    { to: '/production/document', label: '문서 작성' },
  ] },
  { label: '콘텐츠 관리', items: [
    { to: '/library', label: '제작물 보관함' },
    { to: '/calendar', label: '콘텐츠 캘린더' },
    { to: '/templates', label: '템플릿' },
  ] },
  { label: '자산', items: [
    { to: '/assets/images', label: '이미지' },
    { to: '/assets/videos', label: '영상' },
    { to: '/assets/documents', label: '문서' },
  ] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { advertisers, selectedId, setSelectedId, loading } = useAdvertiserContext();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  const nav = (
    <nav className="cs-nav">
      {NAV_GROUPS.map((group, i) => (
        <div key={i}>
          {group.label && <div className="cs-nav-group-label">{group.label}</div>}
          {group.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="cs-shell">
      <aside className="cs-sidebar">
        <div className="cs-sidebar-logo">HOWTOM<br/>콘텐츠 제작소</div>
        {nav}
      </aside>

      {mobileNavOpen && (
        <div className="cs-mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)}>
          <aside className="cs-mobile-nav" onClick={e => e.stopPropagation()}>
            <div className="cs-mobile-nav-head">
              <b>HOWTOM 콘텐츠 제작소</b>
              <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="메뉴 닫기">×</button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="cs-main">
        <header className="cs-topbar">
          <div className="cs-topbar-left">
            <button className="cs-mobile-menu-btn" type="button" onClick={() => setMobileNavOpen(true)} aria-label="메뉴 열기">☰</button>
            <AppSwitcher />
          </div>
          <div className="cs-topbar-actions">
            <select className="cs-select" value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={loading} aria-label="광고주 선택">
              <option value={ALL_ADVERTISERS_ID}>{loading ? '전체 보기 · 불러오는 중...' : `전체 보기${advertisers.length ? ` (${advertisers.length})` : ''}`}</option>
              {advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span className="cs-user-name">{user?.name}</span>
            <button className="cs-btn" onClick={() => { logout(); navigate('/login'); }}>로그아웃</button>
          </div>
        </header>
        <main className="cs-content">{children}</main>
      </div>
    </div>
  );
}
