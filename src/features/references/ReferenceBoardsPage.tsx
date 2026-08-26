import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, FolderPlus, Pencil, Trash2, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { referencesApi } from './referencesApi';
import type { ReferenceBoard, SavedReference } from './referenceTypes';

export function ReferenceBoardsPage() {
  const navigate = useNavigate();
  const { selectedId } = useAdvertiserContext();
  const [boards, setBoards] = useState<ReferenceBoard[]>([]);
  const [activeBoard, setActiveBoard] = useState<ReferenceBoard | null>(null);
  const [items, setItems] = useState<SavedReference[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState('');
  const [renameValue, setRenameValue] = useState('');

  const loadBoards = () => { referencesApi.boards().then(setBoards).catch(() => setBoards([])); };
  useEffect(() => { loadBoards(); }, []);
  const visibleBoards = boards.filter(b => !selectedId || !b.advertiserId || b.advertiserId === selectedId);

  const openBoard = async (b: ReferenceBoard) => {
    setActiveBoard(b); setLoadingItems(true);
    try { setItems(await referencesApi.boardItems(b.id)); } catch (e) { setNotice(e instanceof Error ? e.message : '불러오지 못했습니다.'); setItems([]); }
    setLoadingItems(false);
  };

  const create = async () => {
    if (!newName.trim()) return;
    try { await referencesApi.createBoard(newName.trim(), selectedId || undefined); setNewName(''); setCreating(false); loadBoards(); }
    catch (e) { setNotice(e instanceof Error ? e.message : '보드를 만들지 못했습니다.'); }
  };
  const rename = async (id: string) => {
    if (!renameValue.trim()) { setRenamingId(''); return; }
    try { await referencesApi.renameBoard(id, renameValue.trim()); setRenamingId(''); loadBoards(); if (activeBoard?.id === id) setActiveBoard({ ...activeBoard, name: renameValue.trim() }); }
    catch (e) { setNotice(e instanceof Error ? e.message : '이름을 바꾸지 못했습니다.'); }
  };
  const removeBoard = async (b: ReferenceBoard) => {
    if (!confirm(`"${b.name}" 보드를 삭제할까요? 보드 안 레퍼런스 자체는 삭제되지 않습니다.`)) return;
    try { await referencesApi.deleteBoard(b.id); if (activeBoard?.id === b.id) setActiveBoard(null); loadBoards(); }
    catch (e) { setNotice(e instanceof Error ? e.message : '삭제하지 못했습니다.'); }
  };
  const removeItem = async (refId: string) => {
    if (!activeBoard) return;
    try { await referencesApi.removeFromBoard(activeBoard.id, refId); setItems(rows => rows.filter(r => r.id !== refId)); loadBoards(); }
    catch (e) { setNotice(e instanceof Error ? e.message : '제거하지 못했습니다.'); }
  };

  if (activeBoard) {
    return (
      <div className="content-system-page">
        <PageHeader title={activeBoard.name} description="이 보드에 저장된 레퍼런스입니다." action={<button className="cs-btn" onClick={() => setActiveBoard(null)}>보드 목록</button>} />
        {notice && <div className="content-notice">{notice}</div>}
        {loadingItems ? <div className="content-empty">불러오는 중...</div> : (
          <div className="content-reference-grid">
            {items.map(r => (
              <article key={r.id} className="cs-card content-reference-card">
                <div className="content-reference-preview">
                  {r.adSnapshotUrl ? <a href={r.adSnapshotUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--accent)', padding: 16, textAlign: 'center' }}><ExternalLink size={20} style={{ marginBottom: 6 }} /><br />원본 보기</a> : <span>미리보기 없음</span>}
                </div>
                <div className="content-reference-body">
                  <b style={{ fontSize: 13 }}>{r.pageName || r.advertiserName || '레퍼런스'}</b>
                  {r.headline && <p style={{ fontWeight: 650 }}>{r.headline}</p>}
                  <p>{r.body || r.description || '-'}</p>
                  <div className="content-card-actions" style={{ flexWrap: 'wrap' }}>
                    <button onClick={() => navigate(`/production/ad?refBody=${encodeURIComponent(r.body || '')}&refHeadline=${encodeURIComponent(r.headline || '')}`)}>광고 만들기</button>
                    <button className="danger" onClick={() => removeItem(r.id)}><X size={13} /> 보드에서 빼기</button>
                  </div>
                </div>
              </article>
            ))}
            {!items.length && <div className="content-empty">이 보드에 담긴 레퍼런스가 없습니다. "레퍼런스 탐색"에서 담아보세요.</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="content-system-page">
      <PageHeader title="레퍼런스 보드" description="레퍼런스를 주제별 보드로 모아서 관리합니다." action={<button className="cs-btn cs-btn-primary" onClick={() => setCreating(true)}><FolderPlus size={15} /> 새 보드</button>} />
      {notice && <div className="content-notice">{notice}</div>}
      {creating && (
        <section className="cs-card" style={{ display: 'flex', gap: 8, padding: 14 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} placeholder="보드 이름 (예: 9월 신제품 참고)" style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px' }} autoFocus />
          <button className="cs-btn cs-btn-primary" onClick={create}>만들기</button>
          <button className="cs-btn" onClick={() => { setCreating(false); setNewName(''); }}>취소</button>
        </section>
      )}
      <section className="content-template-grid">
        {visibleBoards.map(b => (
          <article key={b.id} className="cs-card content-template-card">
            {renamingId === b.id ? (
              <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && rename(b.id)} onBlur={() => rename(b.id)} autoFocus style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 9px' }} />
            ) : (
              <h3 style={{ cursor: 'pointer' }} onClick={() => openBoard(b)}>{b.name}</h3>
            )}
            <span>{b.itemCount}개 레퍼런스</span>
            <div className="content-card-actions">
              <button onClick={() => openBoard(b)}>열기</button>
              <button onClick={() => { setRenamingId(b.id); setRenameValue(b.name); }}><Pencil size={13} /></button>
              <button className="danger" onClick={() => removeBoard(b)}><Trash2 size={13} /></button>
            </div>
          </article>
        ))}
        {!visibleBoards.length && <div className="content-empty">아직 만든 보드가 없습니다.</div>}
      </section>
    </div>
  );
}
