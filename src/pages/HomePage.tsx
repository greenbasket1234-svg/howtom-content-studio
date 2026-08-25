import { Link } from 'react-router-dom';
import { useAdvertiserContext } from '../context/AdvertiserContext';

export function HomePage() {
  const { selected, isAllSelected, advertisers } = useAdvertiserContext();

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>HOWTOM 콘텐츠 제작소</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        {isAllSelected
          ? `현재 범위: 전체 광고주${advertisers.length ? ` (${advertisers.length}개)` : ''}`
          : selected
            ? `현재 광고주: ${selected.name}`
            : '등록된 광고주가 없습니다.'}
      </p>

      {/* 아래 3개 수치는 레퍼런스/제작물 기능이 아직 이 앱으로 이전되지 않은 PHASE 1이라
          실제 데이터가 없습니다. 가짜 숫자를 채우지 않고, PHASE 2 이후 실데이터로 연결됩니다. */}
      <div className="cs-kpi-grid">
        <div className="cs-kpi-card"><span>저장한 레퍼런스</span><b>—</b></div>
        <div className="cs-kpi-card"><span>이번 주 제작물</span><b>—</b></div>
        <div className="cs-kpi-card"><span>진행중 콘텐츠</span><b>—</b></div>
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>빠른 실행</h2>
      <div className="cs-quick-grid">
        <Link className="cs-quick-btn" to="/references">레퍼런스 찾기</Link>
        <Link className="cs-quick-btn" to="/production/ad">광고 만들기</Link>
        <Link className="cs-quick-btn" to="/production/blog">블로그 만들기</Link>
        <Link className="cs-quick-btn" to="/production/video-script">영상 대본 만들기</Link>
      </div>

      <div className="cs-card cs-stub-card">
        <b>PHASE 1 안내</b>
        레퍼런스·제작 기능은 아직 이 앱으로 이전되지 않았습니다.<br/>
        지금은 광고주 공유·화면 이동이 정상 동작하는지 확인하는 단계입니다.
      </div>
    </div>
  );
}
