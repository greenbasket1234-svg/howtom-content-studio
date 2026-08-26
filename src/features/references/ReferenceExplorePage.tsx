import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, FolderPlus, Save, Search, Trash2, Trophy } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { referencesApi } from './referencesApi';
import type { ReferenceBoard, SavedReference, SearchResult } from './referenceTypes';

const fmt = (v?: string | null) => { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };
type Platform = 'meta' | 'youtube';

export function ReferenceExplorePage() {
  const navigate = useNavigate();
  const { advertisers, selectedId } = useAdvertiserContext();
  const [connectorStatus, setConnectorStatus] = useState<{ meta: boolean; youtube: boolean } | null>(null);
  const [platform, setPlatform] = useState<Platform>('meta');
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searchError, setSearchError] = useState('');
  const [saved, setSaved] = useState<SavedReference[]>([]);
  const [boards, setBoards] = useState<ReferenceBoard[]>([]);
  const [boardPickerFor, setBoardPickerFor] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { referencesApi.connectorStatus().then(setConnectorStatus).catch(() => setConnectorStatus({ meta: false, youtube: false })); }, []);
  const loadSaved = () => { referencesApi.list(selectedId || undefined).then(setSaved).catch(() => setSaved([])); };
  useEffect(() => { loadSaved(); referencesApi.boards().then(setBoards).catch(() => setBoards([])); }, [selectedId]);
  const platformConfigured = platform === 'meta' ? connectorStatus?.meta : connectorStatus?.youtube;

  const runSearch = async () => {
    if (!keyword.trim()) { setSearchError('검색어를 입력하세요.'); return; }
    setSearching(true); setSearchError(''); setResults(null);
    try {
      const res = await referencesApi.search({ platform, keyword: keyword.trim() });
      if (res.status === 'error') setSearchError(res.error || '검색에 실패했습니다.');
      else setResults(res.results || []);
    } catch (e) { setSearchError(e instanceof Error ? e.message : '검색에 실패했습니다.'); }
    setSearching(false);
  };

  const saveResult = async (r: SearchResult) => {
    const adv = advertisers.find(a => a.id === selectedId);
    try {
      await referencesApi.save({
        advertiserId: adv?.id, platform, externalId: r.externalId, pageName: r.pageName,
        body: r.body, headline: r.headline, description: r.description, cta: r.cta,
        thumbnailUrl: r.thumbnailUrl || undefined, adSnapshotUrl: r.adSnapshotUrl || undefined, startDate: r.startDate || undefined,
        isActive: r.isActive, flightDays: r.flightDays ?? undefined, viewCount: r.viewCount ?? undefined, likeCount: r.likeCount ?? undefined,
      });
      setNotice('저장했습니다.'); loadSaved();
    } catch (e) { setNotice(e instanceof Error ? e.message : '저장하지 못했습니다.'); }
  };
  const removeSaved = async (id: string) => {
    if (!confirm('이 레퍼런스를 삭제할까요?')) return;
    try { await referencesApi.remove(id); loadSaved(); } catch (e) { setNotice(e instanceof Error ? e.message : '삭제하지 못했습니다.'); }
  };
  const addToBoard = async (refId: string, boardId: string) => {
    try { await referencesApi.addToBoard(boardId, refId); setNotice('보드에 담았습니다.'); referencesApi.boards().then(setBoards); }
    catch (e) { setNotice(e instanceof Error ? e.message : '보드에 담지 못했습니다.'); }
    setBoardPickerFor('');
  };
  const useForProduction = (ref: SavedReference | SearchResult, route: string) => {
    const params = new URLSearchParams({
      refBody: ref.body || '', refHeadline: ref.headline || '', refDescription: ref.description || '', refCta: ref.cta || '',
    });
    navigate(`${route}?${params.toString()}`);
  };

  return (
    <div className="content-system-page">
      <PageHeader title="레퍼런스 탐색" description="Meta 광고 라이브러리, YouTube 영상에서 참고할 콘텐츠를 검색하고 저장합니다." />
      {notice && <div className="content-notice">{notice}</div>}

      <div className="content-quick-tabs">
        <button className={platform === 'meta' ? 'active' : ''} onClick={() => { setPlatform('meta'); setResults(null); }}>Meta 광고</button>
        <button className={platform === 'youtube' ? 'active' : ''} onClick={() => { setPlatform('youtube'); setResults(null); }}>YouTube 영상</button>
      </div>

      {connectorStatus && platformConfigured === false && (
        <div className="content-notice" style={{ background: '#fef2f2', color: '#b91c1c' }}>
          {platform === 'meta'
            ? <>Meta 광고 라이브러리 연동이 아직 설정되지 않았습니다. 관리자가 신원 확인을 마친 계정의 <code>META_AD_LIBRARY_ACCESS_TOKEN</code>을 등록해야 검색이 가능합니다.</>
            : <>YouTube 연동이 아직 설정되지 않았습니다. 관리자가 <code>YOUTUBE_API_KEY</code>(YouTube Data API v3)를 등록해야 검색이 가능합니다.</>}
        </div>
      )}

      <section className="cs-card content-toolbar">
        <div className="content-search" style={{ flex: 1 }}><Search size={16} /><input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} placeholder={platform === 'meta' ? '검색할 키워드 (예: 다이어트 보조제)' : '검색할 키워드 (예: 다이어트 보조제 후기)'} /></div>
        <button className="cs-btn cs-btn-primary" onClick={runSearch} disabled={searching || platformConfigured === false}>{searching ? '검색 중...' : '검색'}</button>
      </section>
      {searchError && <div className="content-notice" style={{ background: '#fef2f2', color: '#b91c1c' }}>{searchError}</div>}

      {results && (
        <section>
          <h3 style={{ fontSize: 14, margin: '4px 0 10px' }}>검색 결과 {results.length}건</h3>
          <div className="content-reference-grid">
            {results.map(r => (
              <article key={r.externalId} className="cs-card content-reference-card">
                <div className="content-reference-preview" style={{ cursor: 'default' }}>
                  {r.thumbnailUrl ? (
                    <a href={r.adSnapshotUrl || undefined} target="_blank" rel="noreferrer"><img src={r.thumbnailUrl} alt={r.headline} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></a>
                  ) : r.adSnapshotUrl ? (
                    <a href={r.adSnapshotUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--accent)', padding: 16, textAlign: 'center' }}><ExternalLink size={22} style={{ marginBottom: 6 }} /><br />원본 보기</a>
                  ) : <span>미리보기 없음</span>}
                </div>
                <div className="content-reference-body">
                  {r.isLongRunning && <span className="content-status good" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4 }}><Trophy size={12} /> 장기 게재 · {r.flightDays}일째</span>}
                  <b style={{ fontSize: 13 }}>{r.pageName}</b>
                  {r.headline && <p style={{ fontWeight: 650 }}>{r.headline}</p>}
                  <p>{r.body || r.description || '본문 텍스트가 제공되지 않았습니다.'}</p>
                  <small style={{ color: 'var(--text-muted)' }}>
                    {platform === 'youtube'
                      ? <>{r.startDate ? `게시일 ${fmt(r.startDate)}` : ''}{r.viewCount !== null && r.viewCount !== undefined ? ` · 조회수 ${r.viewCount.toLocaleString()}` : ''}{r.likeCount !== null && r.likeCount !== undefined ? ` · 좋아요 ${r.likeCount.toLocaleString()}` : ''}</>
                      : <>{r.startDate ? `시작일 ${fmt(r.startDate)}` : ''} {r.isActive ? '· 게재 중' : '· 종료됨'}{r.flightDays !== null ? ` · ${r.flightDays}일 게재` : ''}</>}
                  </small>
                  <div className="content-card-actions">
                    <button onClick={() => saveResult(r)}><Save size={13} /> 저장</button>
                  </div>
                </div>
              </article>
            ))}
            {!results.length && <div className="content-empty">검색 결과가 없습니다.</div>}
          </div>
        </section>
      )}

      <section>
        <h3 style={{ fontSize: 14, margin: '18px 0 10px' }}>저장한 레퍼런스 {saved.length}건</h3>
        <div className="content-reference-grid">
          {saved.map(r => (
            <article key={r.id} className="cs-card content-reference-card">
              <div className="content-reference-preview" style={{ cursor: 'default' }}>
                {r.thumbnailUrl ? (
                  <a href={r.adSnapshotUrl || undefined} target="_blank" rel="noreferrer"><img src={r.thumbnailUrl} alt={r.headline || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></a>
                ) : r.adSnapshotUrl ? (
                  <a href={r.adSnapshotUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--accent)', padding: 16, textAlign: 'center' }}><ExternalLink size={22} style={{ marginBottom: 6 }} /><br />원본 보기</a>
                ) : <span>미리보기 없음</span>}
              </div>
              <div className="content-reference-body">
                {r.flightDays !== null && r.flightDays >= 30 && r.isActive && <span className="content-status good" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4 }}><Trophy size={12} /> 장기 게재 · {r.flightDays}일째</span>}
                <b style={{ fontSize: 13 }}>{r.pageName || r.advertiserName || '레퍼런스'}</b>
                {r.headline && <p style={{ fontWeight: 650 }}>{r.headline}</p>}
                <p>{r.body || r.description || '-'}</p>
                {r.platform === 'youtube' && r.viewCount !== null && <small style={{ color: 'var(--text-muted)' }}>조회수 {Number(r.viewCount).toLocaleString()}{r.likeCount !== null ? ` · 좋아요 ${Number(r.likeCount).toLocaleString()}` : ''}</small>}
                {r.boards.length > 0 && <div className="content-tag-row">{r.boards.map(b => <span key={b.boardId}>{b.boardName}</span>)}</div>}
                <div className="content-card-actions" style={{ flexWrap: 'wrap', position: 'relative' }}>
                  <button onClick={() => setBoardPickerFor(boardPickerFor === r.id ? '' : r.id)}><FolderPlus size={13} /> 보드에 담기</button>
                  {boardPickerFor === r.id && (
                    <div className="content-ref-picker-pop" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: '#fff', width: 200 }}>
                      {boards.length ? boards.map(b => <label key={b.id} onClick={() => addToBoard(r.id, b.id)} style={{ cursor: 'pointer' }}>{b.name}</label>) : <small style={{ color: 'var(--text-muted)' }}>보드가 없습니다. "레퍼런스 보드"에서 먼저 만들어주세요.</small>}
                    </div>
                  )}
                  <button onClick={() => useForProduction(r, '/production/ad')}>광고 문구 만들기</button>
                  <button onClick={() => useForProduction(r, '/production/blog')}>블로그 만들기</button>
                  <button onClick={() => useForProduction(r, '/production/video-script')}>영상 대본 만들기</button>
                  <button className="danger" onClick={() => removeSaved(r.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            </article>
          ))}
          {!saved.length && <div className="content-empty">아직 저장한 레퍼런스가 없습니다. 위에서 검색 후 저장해보세요.</div>}
        </div>
      </section>
    </div>
  );
}
