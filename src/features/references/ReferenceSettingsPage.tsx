import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, PlayCircle, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { referencesApi } from './referencesApi';

export function ReferenceSettingsPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [worker, setWorker] = useState<Awaited<ReturnType<typeof referencesApi.workerStatus>> | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('');

  const loadWorker = () => referencesApi.workerStatus().then(setWorker).catch(() => setWorker(null));
  useEffect(() => {
    referencesApi.connectorStatus().then(s => setConfigured(s.configured)).catch(() => setConfigured(false));
    loadWorker();
  }, []);

  const runNow = async () => {
    setRunning(true);
    try { const res = await referencesApi.runWorkerNow(); setNotice(res.message); }
    catch (e) { setNotice(e instanceof Error ? e.message : '실행하지 못했습니다.'); }
    setRunning(false);
    setTimeout(loadWorker, 3000);
  };

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
        <div className="content-section-head"><h3>레퍼런스 자동 수집 Worker</h3><button className="cs-btn cs-btn-primary" onClick={runNow} disabled={running || !configured}><PlayCircle size={15} /> {running ? '실행 요청 중...' : '지금 바로 실행'}</button></div>
        {notice && <div className="content-notice">{notice}</div>}
        {worker ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: worker.enabled ? '#16a34a' : '#dc2626', flexShrink: 0 }} />
            <div style={{ fontSize: 13.5 }}>
              {worker.enabled ? (
                <>
                  <b>자동 수집 켜짐</b> · 매일 한국시간 {worker.hoursKst.join(', ')}시에 등록된 모든 경쟁 브랜드를 자동으로 수집합니다.
                  {worker.lastRunAt ? (
                    <> · 마지막 실행: {new Date(worker.lastRunAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {worker.lastResult && ` (신규 ${worker.lastResult.newCount}건 · 갱신 ${worker.lastResult.updatedCount}건 · 실패 브랜드 ${worker.lastResult.failedCount}개)`}
                    </>
                  ) : ' · 아직 실행 이력이 없습니다.'}
                </>
              ) : <><b>자동 수집 꺼짐</b> · Meta 광고 라이브러리가 연결되지 않았습니다.</>}
            </div>
          </div>
        ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>상태를 불러오는 중입니다...</p>}
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '8px 0 0' }}>새로 발견된 경쟁사 광고는 자동으로 레퍼런스에 저장되고, 이미 저장된 광고는 게재 중/종료 상태만 최신으로 갱신됩니다(문구 등 내용은 유지).</p>
      </section>

      <section className="cs-card content-section">
        <div className="content-section-head"><h3>현재 수집 방식</h3></div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, color: 'var(--text-secondary)' }}>
          <li><b>레퍼런스 탐색</b>에서 키워드를 입력해 검색하면 실시간으로 Meta 광고 라이브러리를 조회합니다. 저장 버튼을 눌러야만 실제로 보관됩니다.</li>
          <li><b>경쟁사 모니터링</b>에 등록한 브랜드는 위 자동 수집 Worker가 하루 2번 자동으로 수집하며, <b>"지금 수집"</b> 버튼으로 즉시 확인할 수도 있습니다.</li>
          <li>검색 결과 자체(썸네일·영상 원본)는 서버에 저장하지 않고, 페이지 미리보기 링크(<code>ad_snapshot_url</code>)만 보여줍니다. 저장한 레퍼런스만 필요한 정보(문구·링크 등)를 데이터베이스에 남깁니다.</li>
          <li>매체 지출·노출 등 성과 데이터는 Meta 광고 라이브러리 API가 제공하지 않아 표시하지 않습니다.</li>
        </ul>
      </section>
    </div>
  );
}
