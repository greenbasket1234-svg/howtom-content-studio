import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { blogApi, type SeatListItem } from './blogApi';

/**
 * 오토포스트 Pro 좌석·사용량 관리 화면입니다. 광고주 계약이 끝나거나 블로그 서비스를
 * 중단하면 여기서 좌석을 정지(suspend)하고, 재개하려면 다시 활성화(activate)합니다.
 * 서버 API(GET/POST /api/blog/autopost-pro/seats, /usage)는 이미 완성되어 있고, 이 화면은
 * 그 위에 얹은 조회·조작 UI입니다.
 */
export function AutopostProAdminPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [seats, setSeats] = useState<SeatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const loadSeats = async () => {
    setLoading(true);
    try {
      const status = await blogApi.aiStatus();
      setConfigured(status.provider === 'autopost-pro');
      if (status.provider === 'autopost-pro') setSeats(await blogApi.listAutopostProSeats());
    } catch (e) { setNotice(e instanceof Error ? e.message : '좌석 목록을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadSeats(); }, []);

  const loadUsage = async () => {
    setUsageLoading(true); setUsage(null);
    try { setUsage(await blogApi.autopostProUsage(month)); }
    catch (e) { setNotice(e instanceof Error ? e.message : '사용량 조회에 실패했습니다.'); }
    finally { setUsageLoading(false); }
  };

  const toggle = async (seat: SeatListItem) => {
    const suspending = seat.status === 'active';
    if (!window.confirm(`${seat.advertiser_name}의 오토포스트 Pro 좌석을 ${suspending ? '정지' : '재개'}할까요?`)) return;
    setActingOn(seat.advertiser_id);
    try {
      if (suspending) await blogApi.suspendAutopostProSeat(seat.advertiser_id);
      else await blogApi.activateAutopostProSeat(seat.advertiser_id);
      await loadSeats();
    } catch (e) { setNotice(e instanceof Error ? e.message : '좌석 상태 변경에 실패했습니다.'); }
    finally { setActingOn(null); }
  };

  if (configured === false) {
    return <div className="blog26-page">
      <PageHeader title="오토포스트 Pro 관리" description="광고주별 좌석·월별 사용량을 확인·관리합니다." />
      <section className="cs-card blog26-list-empty"><b>아직 연결되지 않았습니다</b><span>관리자가 AUTOPOST_PRO_API_KEY를 설정하면 이 화면에서 좌석과 사용량을 관리할 수 있습니다.</span></section>
    </div>;
  }

  return (
    <div className="blog26-page">
      <PageHeader title="오토포스트 Pro 관리" description="광고주별 좌석 상태를 확인·정지·재개하고, 월별 사용량을 조회합니다." />
      {notice && <div className="content-notice">{notice} <button onClick={() => setNotice('')} style={{ border: 0, background: 'none', cursor: 'pointer', marginLeft: 8 }}>×</button></div>}

      <section className="cs-card">
        <div className="blog26-side-head"><div><b>좌석 현황</b></div><button className="cs-btn" onClick={() => void loadSeats()} disabled={loading}>새로고침</button></div>
        {loading ? <p className="blog26-muted">불러오는 중...</p> : (
          <div className="blog26-project-table">
            <table>
              <thead><tr><th>광고주</th><th>플랜</th><th>무료체험 잔여</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {seats.map(seat => (
                  <tr key={seat.advertiser_id}>
                    <td>{seat.advertiser_name}</td>
                    <td>{seat.plan === 'trial' ? '무료체험' : '유료'}</td>
                    <td>{seat.plan === 'trial' ? (seat.trial_remaining ?? '-') : '-'}</td>
                    <td><span className={`blog26-pill ${seat.status === 'active' ? 'success' : 'warning'}`}>{seat.status === 'active' ? '정상' : seat.status === 'suspended' ? '정지됨' : seat.status}</span></td>
                    <td><button className="cs-btn" onClick={() => void toggle(seat)} disabled={actingOn === seat.advertiser_id}>{seat.status === 'active' ? '정지' : '재개'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!seats.length && <p className="blog26-muted" style={{ padding: 14 }}>아직 생성된 좌석이 없습니다(광고주가 처음 초안을 생성할 때 자동으로 만들어집니다).</p>}
          </div>
        )}
      </section>

      <section className="cs-card">
        <div className="blog26-side-head">
          <div><b>월별 사용량·정산</b></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
            <button className="cs-btn cs-btn-primary" onClick={() => void loadUsage()} disabled={usageLoading}>{usageLoading ? '조회 중...' : '조회'}</button>
          </div>
        </div>
        <p className="blog26-muted">부가세(VAT)는 별도입니다. 오토포스트 Pro 응답 형식이 바뀔 수 있어, 원본 데이터를 그대로 함께 보여드립니다.</p>
        {usage && <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, fontSize: 12, overflow: 'auto', maxHeight: 360 }}>{JSON.stringify(usage, null, 2)}</pre>}
      </section>
    </div>
  );
}
