import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Plus, RefreshCw, Save, Trash2, Trophy } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { referencesApi } from './referencesApi';
import type { Competitor, SearchResult } from './referenceTypes';

export function CompetitorMonitoringPage() {
  const { advertisers, selectedId } = useAdvertiserContext();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [collecting, setCollecting] = useState('');
  const [results, setResults] = useState<Record<string, SearchResult[] | 'error'>>({});

  const load = () => { referencesApi.competitors(selectedId || undefined).then(setCompetitors).catch(() => setCompetitors([])); };
  useEffect(() => { load(); setResults({}); }, [selectedId]);

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const advertiserId = String(f.get('advertiserId') || selectedId || '');
    const brandName = String(f.get('brandName') || '').trim();
    if (!advertiserId || !brandName) { setNotice('광고주와 경쟁 브랜드명을 입력하세요.'); return; }
    try {
      await referencesApi.addCompetitor({ advertiserId, brandName, pageName: String(f.get('pageName') || '').trim() || undefined });
      setOpen(false); load();
    } catch (err) { setNotice(err instanceof Error ? err.message : '등록하지 못했습니다.'); }
  };
  const remove = async (id: string) => {
    if (!confirm('이 경쟁 브랜드를 삭제할까요?')) return;
    try { await referencesApi.removeCompetitor(id); load(); } catch (err) { setNotice(err instanceof Error ? err.message : '삭제하지 못했습니다.'); }
  };

  const collectNow = async (c: Competitor) => {
    setCollecting(c.id); setNotice('');
    try {
      const res = await referencesApi.search({ keyword: c.pageName || c.brandName });
      if (res.status === 'error') { setResults(prev => ({ ...prev, [c.id]: 'error' })); setNotice(res.error || '수집에 실패했습니다.'); }
      else setResults(prev => ({ ...prev, [c.id]: res.results || [] }));
    } catch (err) {
      setResults(prev => ({ ...prev, [c.id]: 'error' }));
      setNotice(err instanceof Error ? err.message : '수집에 실패했습니다.');
    }
    setCollecting('');
  };
  const saveResult = async (c: Competitor, r: SearchResult) => {
    try {
      await referencesApi.save({
        advertiserId: c.advertiserId, platform: 'meta', externalId: r.externalId, pageName: r.pageName, isCompetitor: true,
        body: r.body, headline: r.headline, description: r.description, cta: r.cta,
        adSnapshotUrl: r.adSnapshotUrl || undefined, startDate: r.startDate || undefined, isActive: r.isActive, flightDays: r.flightDays ?? undefined,
      });
      setNotice('레퍼런스로 저장했습니다.');
    } catch (err) { setNotice(err instanceof Error ? err.message : '저장하지 못했습니다.'); }
  };

  return (
    <div className="content-system-page">
      <PageHeader title="경쟁사 모니터링" description="광고주별 경쟁 브랜드를 등록하고, 지금 수집으로 최근 광고를 확인합니다." action={<button className="cs-btn cs-btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> 경쟁 브랜드 등록</button>} />
      {notice && <div className="content-notice">{notice}</div>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {competitors.map(c => (
          <article key={c.id} className="cs-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div><b style={{ fontSize: 15 }}>{c.brandName}</b>{c.pageName && <span style={{ color: 'var(--text-muted)', fontSize: 12.5, marginLeft: 8 }}>{c.pageName}</span>}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="cs-btn" onClick={() => collectNow(c)} disabled={collecting === c.id}><RefreshCw size={14} className={collecting === c.id ? 'spin' : ''} /> {collecting === c.id ? '수집 중...' : '지금 수집'}</button>
                <button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(c.id)}><Trash2 size={14} /></button>
              </div>
            </div>
            {results[c.id] === 'error' && <p className="content-empty small">수집에 실패했습니다. 위 알림을 확인하세요.</p>}
            {Array.isArray(results[c.id]) && (
              <div className="content-reference-grid">
                {(results[c.id] as SearchResult[]).map(r => (
                  <article key={r.externalId} className="cs-card content-reference-card">
                    <div className="content-reference-preview">
                      {r.adSnapshotUrl ? <a href={r.adSnapshotUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--accent)', padding: 16, textAlign: 'center' }}><ExternalLink size={20} style={{ marginBottom: 6 }} /><br />원본 보기</a> : <span>미리보기 없음</span>}
                    </div>
                    <div className="content-reference-body">
                      {r.isLongRunning && <span className="content-status good" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4 }}><Trophy size={12} /> 장기 게재 · {r.flightDays}일째</span>}
                      {r.headline && <p style={{ fontWeight: 650 }}>{r.headline}</p>}
                      <p>{r.body || r.description || '-'}</p>
                      <div className="content-card-actions"><button onClick={() => saveResult(c, r)}><Save size={13} /> 레퍼런스로 저장</button></div>
                    </div>
                  </article>
                ))}
                {!(results[c.id] as SearchResult[]).length && <div className="content-empty small">최근 게재 중인 광고를 찾지 못했습니다.</div>}
              </div>
            )}
          </article>
        ))}
        {!competitors.length && <div className="content-empty">등록된 경쟁 브랜드가 없습니다. 위에서 등록해보세요.</div>}
      </section>

      {open && (
        <div className="content-modal-backdrop" onClick={() => setOpen(false)}>
          <form className="content-modal" onSubmit={add} onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="content-modal-head"><div><h3>경쟁 브랜드 등록</h3></div></div>
            <div className="content-form-grid">
              <label className="span2">광고주<select name="advertiserId" defaultValue={selectedId}>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label className="span2">경쟁 브랜드명<input name="brandName" placeholder="예: 오뚜기" required /></label>
              <label className="span2">페이스북 페이지명(선택)<input name="pageName" placeholder="검색 정확도를 높이려면 입력" /></label>
            </div>
            <div className="content-modal-actions"><button type="button" className="cs-btn" onClick={() => setOpen(false)}>취소</button><button className="cs-btn cs-btn-primary" type="submit">등록</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
