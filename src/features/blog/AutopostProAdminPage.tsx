import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { blogApi, type SeatListItem } from './blogApi';

// 오토포스트 Pro의 월 한도는 한국 시간 기준입니다 - toISOString()은 UTC라서, 자정
// 전후(한국 새벽 시간대) 경계에서 실제와 다른 달을 보여줄 수 있어 KST로 보정합니다.
function currentKstMonth(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 7);
}

/**
 * 오토포스트 Pro 좌석·사용량 관리 화면입니다. 광고주 계약이 끝나거나 블로그 서비스를
 * 중단하면 여기서 좌석을 정지(suspend)하고, 재개하려면 다시 활성화(activate)합니다.
 * 서버 API(GET/POST /api/blog/autopost-pro/seats, /usage)는 이미 완성되어 있고, 이 화면은
 * 그 위에 얹은 조회·조작 UI입니다.
 */
/** 오토포스트 Pro의 /v1/usage 정확한 응답 필드가 문서로 100% 확인되지 않아, 흔히 쓰이는
 * 필드명 후보들을 최선을 다해 찾아서 요약 카드로 보여줍니다. 못 찾으면 그냥 숨기고,
 * 실제 값은 항상 원본 JSON(details)으로 확인할 수 있게 해둡니다. */
function UsageSummaryCards({usage}:{usage:Record<string,unknown>}){
  const num=(v:unknown)=>typeof v==='number'?v:undefined;
  const pick=(...keys:string[])=>{for(const k of keys){if(usage[k]!==undefined)return usage[k];}return undefined;};
  const activeSeats=num(pick('active_seats','activeSeats','seat_count'));
  const paidSeats=num(pick('paid_seats','paidSeats'));
  const overageCount=num(pick('overage_count','overageCount','total_overage'));
  const estimatedTotal=num(pick('estimated_total_krw','estimatedTotalKrw'));
  const byAdvertiser=pick('by_advertiser','advertisers','usage_by_advertiser','items') as Array<Record<string,unknown>>|undefined;
  const cards=[
    activeSeats!==undefined&&{label:'활성 좌석',value:`${activeSeats}개`},
    paidSeats!==undefined&&{label:'유료 전환 좌석',value:`${paidSeats}개`},
    overageCount!==undefined&&{label:'초과 생성',value:`${overageCount}건`},
    estimatedTotal!==undefined&&{label:'예상 도매 정산액(VAT 별도)',value:`${estimatedTotal.toLocaleString()}원`},
  ].filter(Boolean) as {label:string;value:string}[];
  return <>
    {cards.length>0&&<div className="blog26-kpis" style={{marginTop:10}}>{cards.map(c=><article className="cs-card" key={c.label}><span>{c.label}</span><b>{c.value}</b></article>)}</div>}
    {Array.isArray(byAdvertiser)&&byAdvertiser.length>0&&<div className="blog26-project-table" style={{marginTop:10}}>
      <table><thead><tr><th>광고주</th><th>생성량</th><th>기본 한도</th></tr></thead><tbody>
        {byAdvertiser.map((row,i)=><tr key={i}><td>{String(row.advertiser_name??row.name??'-')}</td><td>{String(row.used??row.count??'-')}</td><td>{String(row.limit??row.quota_limit??'-')}</td></tr>)}
      </tbody></table>
    </div>}
  </>;
}
export function AutopostProAdminPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [seats, setSeats] = useState<SeatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [month, setMonth] = useState(() => currentKstMonth());
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
        <p className="blog26-muted">부가세(VAT)는 별도입니다. 아래 요약은 흔한 필드명을 추정해서 보여주는 것이라, 실제 값은 그 아래 원본 데이터로 항상 함께 확인하세요.</p>
        {usage && <UsageSummaryCards usage={usage}/>}
        {usage && <details style={{marginTop:10}}><summary style={{cursor:'pointer',fontSize:12,color:'#64748b'}}>원본 응답 데이터 보기</summary><pre style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:14,fontSize:12,overflow:'auto',maxHeight:360,marginTop:8}}>{JSON.stringify(usage,null,2)}</pre></details>}
      </section>
    </div>
  );
}
