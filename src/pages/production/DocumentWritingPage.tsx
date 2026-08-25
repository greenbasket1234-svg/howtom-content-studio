import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { createProject, deleteProject, loadProjects, patchProject, type ContentProject, type DocumentBlock } from '../../store/contentStore';

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fmt = (v?: string) => { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };
const DOCUMENT_TYPES = ['기획서', '제안 초안', '광고 전략서', '캠페인 계획서', '업무 문서', '회의 정리', '브리프', '교육 자료', '공지', '자유 문서'];

function defaultDocumentBlocks(): DocumentBlock[] {
  return [
    { blockId: uid('doc'), type: 'h1', title: '문서 개요', text: '' },
    { blockId: uid('doc'), type: 'paragraph', title: '목표', text: '' },
    { blockId: uid('doc'), type: 'paragraph', title: '핵심 내용', text: '' },
  ];
}

export function DocumentWritingPage() {
  const { advertisers, selectedId } = useAdvertiserContext();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(() => loadProjects().filter(p => p.projectType === 'document'));
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState('');
  const projectId = params.get('project') || '';
  const [draft, setDraft] = useState<ContentProject | undefined>(() => projectId ? loadProjects().find(p => p.projectId === projectId) : undefined);

  useEffect(() => { const id = params.get('project'); setDraft(id ? loadProjects().find(p => p.projectId === id) : undefined); }, [params]);
  const refresh = () => setRows(loadProjects().filter(p => p.projectType === 'document'));

  const make = () => {
    const advertiser = advertisers.find(a => a.id === selectedId);
    if (!advertiser) { setNotice('먼저 상단에서 광고주를 선택해주세요.'); return; }
    const p = createProject({
      projectType: 'document', title: `${advertiser.name} · 새 문서`, advertiserId: advertiser.id, advertiserName: advertiser.name,
      channel: '사내 문서', objective: '업무 문서', creativeType: '문서', referenceIds: [], hooks: [], copyVariants: [], resultAssetIds: [], status: 'draft',
      documentData: { documentType: '기획서', blocks: defaultDocumentBlocks() },
    });
    setParams({ project: p.projectId }); refresh();
  };
  const patch = (c: Partial<ContentProject>) => { if (!draft) return; const n = patchProject(draft.projectId, c); if (n) setDraft(n); };
  const patchData = (c: Partial<NonNullable<ContentProject['documentData']>>) => patch({ documentData: { ...(draft?.documentData || {}), ...c } });
  const blocks = draft?.documentData?.blocks || [];
  const updateBlock = (id: string, c: Partial<DocumentBlock>) => patchData({ blocks: blocks.map(b => b.blockId === id ? { ...b, ...c } : b) });

  const complete = () => {
    if (!draft) return;
    patch({ status: 'completed' });
    setNotice('문서를 완료 처리했습니다.');
    refresh();
  };
  const remove = (id: string) => {
    if (!confirm('이 문서를 삭제할까요? 되돌릴 수 없습니다.')) return;
    deleteProject(id);
    if (draft?.projectId === id) { setParams({}); }
    refresh();
    setNotice('문서를 삭제했습니다.');
  };

  if (!draft) {
    const visible = rows.filter(p => (!q || [p.title, p.advertiserName, p.documentData?.documentType].join(' ').toLowerCase().includes(q.toLowerCase())) && (!selectedId || p.advertiserId === selectedId));
    return (
      <div className="content-system-page">
        <PageHeader title="문서 작성" description="제안·기획·업무 문서를 블록 단위로 작성합니다." action={<button className="cs-btn cs-btn-primary" onClick={make}><Plus size={15} /> 새 문서</button>} />
        {notice && <div className="content-notice">{notice}</div>}
        <section className="cs-card content-toolbar"><div className="content-search"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="문서 제목·유형 검색" /></div></section>
        <section className="content-project-grid">
          {visible.map(p => (
            <article key={p.projectId} className="cs-card content-project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="badge" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: 999, padding: '3px 9px', fontSize: 11.5, fontWeight: 700 }}>{p.documentData?.documentType || '문서'}</span><small style={{ color: 'var(--text-muted)' }}>{fmt(p.updatedAt)}</small></div>
              <h3 style={{ margin: '6px 0 0', fontSize: 14.5 }}>{p.title}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{p.advertiserName} · 블록 {p.documentData?.blocks?.length || 0}개</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <button className="cs-btn" style={{ flex: 1 }} onClick={() => setParams({ project: p.projectId })}>문서 열기</button>
                <button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(p.projectId)}><Trash2 size={13} /></button>
              </div>
            </article>
          ))}
          {!visible.length && <div className="content-empty">아직 작성한 문서가 없습니다.</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="content-system-page">
      <PageHeader title="문서 작성" description="업무 문서·기획서·제안 초안을 작성합니다." action={<div className="content-header-actions"><button className="cs-btn" onClick={() => setParams({})}>목록</button><button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(draft.projectId)}><Trash2 size={15} /> 삭제</button><button className="cs-btn cs-btn-primary" onClick={complete}><Check size={15} /> 완료 처리</button></div>} />
      {notice && <div className="content-notice">{notice}</div>}
      <section className="cs-card content-section">
        <div className="content-form-grid">
          <label>문서명<input value={draft.title} onChange={e => patch({ title: e.target.value })} /></label>
          <label>광고주<select value={draft.advertiserId} onChange={e => { const a = advertisers.find(x => x.id === e.target.value); patch({ advertiserId: e.target.value, advertiserName: a?.name || '' }); }}>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>문서 유형<select value={draft.documentData?.documentType || '기획서'} onChange={e => patchData({ documentType: e.target.value })}>{DOCUMENT_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
        </div>
      </section>
      <section className="cs-card content-section">
        <div className="content-section-head">
          <h3>문서 블록</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="cs-btn" onClick={() => patchData({ blocks: [...blocks, { blockId: uid('doc'), type: 'h2', title: '새 섹션', text: '' }] })}>+ 섹션</button>
            <button className="cs-btn" onClick={() => patchData({ blocks: [...blocks, { blockId: uid('doc'), type: 'paragraph', title: '', text: '' }] })}>+ 본문</button>
            <button className="cs-btn" onClick={() => patchData({ blocks: [...blocks, { blockId: uid('doc'), type: 'callout', title: '핵심', text: '' }] })}>+ 콜아웃</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {blocks.map(b => (
            <article key={b.blockId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.type.toUpperCase()}</b><button style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#dc2626' }} onClick={() => patchData({ blocks: blocks.filter(x => x.blockId !== b.blockId) })}><Trash2 size={14} /></button></div>
              <input value={b.title || ''} onChange={e => updateBlock(b.blockId, { title: e.target.value })} placeholder="블록 제목" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
              <textarea rows={b.type === 'paragraph' ? 6 : 3} value={b.text || ''} onChange={e => updateBlock(b.blockId, { text: e.target.value })} placeholder="내용 입력" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
            </article>
          ))}
          {!blocks.length && <p className="content-empty small">블록을 추가해서 문서를 작성해보세요.</p>}
        </div>
      </section>
    </div>
  );
}
