import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { referencesApi } from './referencesApi';

export function ReferenceSettingsPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => { referencesApi.connectorStatus().then(s => setConfigured(s.configured)).catch(() => setConfigured(false)); }, []);

  return (
    <div className="content-system-page">
      <PageHeader title="수집 설정" description="레퍼런스 수집에 사용하는 연동 상태와 수집 방식을 확인합니다." />

      <section className="cs-card content-section">
        <div className="content-section-head"><h3>플랫폼 연동 상태</h3></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
          {configured === null ? <span style={{ color: 'var(--text-muted)' }}>확인 중...</span> : configured ? (
            <><CheckCircle2 size={18} color="#16a34a" /><span><b>Meta 광고 라이브러리</b> — 연결됨</span></>
          ) : (
            <><XCircle size={18} color="#dc2626" /><span><b>Meta 광고 라이브러리</b> — 연결되지 않음</span></>
          )}
        </div>
        {configured === false && (
          <div className="content-notice" style={{ background: '#fef2f2', color: '#b91c1c' }}>
            관리자가 신원 확인(Identity Confirmation)을 마친 Meta 계정의 토큰을 <code>META_AD_LIBRARY_ACCESS_TOKEN</code> 환경변수로 등록해야 검색·수집이 가능합니다.
            <br /><a href="https://www.facebook.com/ID" target="_blank" rel="noreferrer" style={{ color: '#b91c1c', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>신원 확인 페이지 열기 <ExternalLink size={13} /></a>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', color: 'var(--text-muted)' }}>
          <XCircle size={18} /><span>Instagram 일반 콘텐츠, YouTube, TikTok, Threads — 아직 지원되지 않음(추후 지원 예정)</span>
        </div>
      </section>

      <section className="cs-card content-section">
        <div className="content-section-head"><h3>현재 수집 방식</h3></div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, color: 'var(--text-secondary)' }}>
          <li><b>레퍼런스 탐색</b>에서 키워드를 입력해 검색하면 실시간으로 Meta 광고 라이브러리를 조회합니다. 저장 버튼을 눌러야만 실제로 보관됩니다.</li>
          <li><b>경쟁사 모니터링</b>에 등록한 브랜드는 자동으로 수집되지 않고, <b>"지금 수집"</b> 버튼을 눌렀을 때만 검색합니다.</li>
          <li>검색 결과 자체(썸네일·영상 원본)는 서버에 저장하지 않고, 페이지 미리보기 링크(<code>ad_snapshot_url</code>)만 보여줍니다. 저장한 레퍼런스만 필요한 정보(문구·링크 등)를 데이터베이스에 남깁니다.</li>
          <li>매체 지출·노출 등 성과 데이터는 Meta 광고 라이브러리 API가 제공하지 않아 표시하지 않습니다.</li>
        </ul>
        <div className="content-notice" style={{ marginTop: 14 }}>
          경쟁사를 정해진 주기로 자동 수집하는 기능은 다음 단계(PHASE 4)에서 별도의 수집 Worker로 추가될 예정입니다.
        </div>
      </section>
    </div>
  );
}
