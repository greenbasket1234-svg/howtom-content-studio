import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { documentApi } from './documentApi';
import type { DocumentBlock, DocumentBlockType, DocumentProject } from './documentTypes';

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fmt = (v?: string) => { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };
const DOCUMENT_TYPES = ['기획서', '제안 초안', '광고 전략서', '캠페인 계획서', '업무 문서', '회의 정리', '브리프', '자유 문서'];

function defaultBlocks(): DocumentBlock[] {
  return [
    { blockId: uid('doc'), type: 'h1', title: '문서 개요', text: '' },
    { blockId: uid('doc'), type: 'paragraph', title: '목표', text: '' },
    { blockId: uid('doc'), type: 'paragraph', title: '핵심 내용', text: '' },
  ];
}

export function DocumentWritingPage() {
  const { advertisers, selectedId } = useAdvertiserContext();
  const [params, setParams] = useSearchParams();
  const projectId = params.get('project') || '';
  const [projects, setProjects] = useState<DocumentProject[]>([]);
  const [project, setProject] = useState<DocumentProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await documentApi.projects(); setProjects(rows);
      if (projectId) { const p = rows.find(x => x.projectId === projectId) || await documentApi.getProject(projectId); setProject(p); } else setProject(null);
    } catch (e) { setNotice(e instanceof Error ? e.message : '문서를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [projectId]);

  const visible = projects.filter(p => (!query || `${p.title} ${p.documentType}`.toLowerCase().includes(query.toLowerCase())) && (!selectedId || p.advertiserId === selectedId));

  const create = async () => {
    const adv = advertisers.find(a => a.id === selectedId);
    if (!adv) { setNotice('먼저 상단에서 광고주를 선택해주세요.'); return; }
    try { const row = await documentApi.createProject({ advertiserId: adv.id, advertiserName: adv.name, title: `${adv.name} · 새 문서`, documentType: '기획서', blocks: defaultBlocks() }); setParams({ project: row.projectId }); }
    catch (e) { setNotice(e instanceof Error ? e.message : '새 문서를 만들지 못했습니다.'); }
  };
  const patch = async (changes: Partial<DocumentProject>) => {
    if (!project) return;
    try { const next = await documentApi.patchProject(project.projectId, changes); setProject(next); setProjects(rows => rows.map(x => x.projectId === next.projectId ? next : x)); }
    catch (e) { setNotice(e instanceof Error ? e.message : '저장하지 못했습니다.'); }
  };
  const patchLocal = (changes: Partial<DocumentProject>) => project && setProject({ ...project, ...changes });
  const save = async () => { if (!project) return; await patch(project); setNotice('저장했습니다.'); };
  const complete = async () => { await patch({ status: 'completed' }); setNotice('완료 처리했습니다.'); };
  const addBlock = (type: DocumentBlockType) => patchLocal({ blocks: [...project!.blocks, { blockId: uid('doc'), type, title: type === 'h2' ? '새 섹션' : type === 'callout' ? '핵심' : '', text: '' }] });
  const updateBlock = (id: string, change: Partial<DocumentBlock>) => patchLocal({ blocks: project!.blocks.map(b => b.blockId === id ? { ...b, ...change } : b) });
  const removeBlock = (id: string) => patchLocal({ blocks: project!.blocks.filter(b => b.blockId !== id) });
  const remove = async (id: string) => {
    const target = projects.find(x => x.projectId === id);
    if (!confirm(`"${target?.title || '이 문서'}"를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try { await documentApi.deleteProject(id); setProjects(rows => rows.filter(x => x.projectId !== id)); if (project?.projectId === id) setParams({}); setNotice('삭제했습니다.'); }
    catch (e) { setNotice(e instanceof Error ? e.message : '삭제하지 못했습니다.'); }
  };

  if (loading) return <div className="content-system-page"><PageHeader title="문서 작성" description="서버 데이터를 불러오는 중입니다." /></div>;

  if (!project) {
    return (
      <div className="content-system-page">
        <PageHeader title="문서 작성" description="제안·기획·업무 문서를 블록 단위로 작성합니다." action={<button className="cs-btn cs-btn-primary" onClick={() => void create()}><Plus size={15} /> 새 문서</button>} />
        {notice && <div className="content-notice">{notice}</div>}
        <section className="cs-card content-toolbar"><div className="content-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="문서 제목·유형 검색" /></div></section>
        <section className="content-project-grid">
          {visible.map(p => (
            <article key={p.projectId} className="cs-card content-project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="content-status neutral">{p.documentType}</span><small style={{ color: 'var(--text-muted)' }}>{fmt(p.updatedAt)}</small></div>
              <h3>{p.title}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{p.advertiserName} · 블록 {p.blocks?.length || 0}개</p>
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
      <PageHeader title="문서 작성" description="업무 문서·기획서·제안 초안을 작성합니다." action={<div className="content-header-actions" style={{ display: 'flex', gap: 8 }}><button className="cs-btn" onClick={() => setParams({})}><ChevronLeft size={15} /> 목록</button><button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(project.projectId)}><Trash2 size={15} /> 삭제</button><button className="cs-btn cs-btn-primary" onClick={() => void complete()}><Check size={15} /> 완료 처리</button></div>} />
      {notice && <div className="content-notice">{notice}</div>}
      <section className="cs-card content-section">
        <div className="content-form-grid">
          <label>문서명<input value={project.title} onChange={e => patchLocal({ title: e.target.value })} onBlur={() => void save()} /></label>
          <label>광고주<select value={project.advertiserId} onChange={e => { const a = advertisers.find(x => x.id === e.target.value); patchLocal({ advertiserId: e.target.value, advertiserName: a?.name || '' }); void patch({ advertiserId: e.target.value, advertiserName: a?.name || '' }); }}>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>문서 유형<select value={project.documentType} onChange={e => { patchLocal({ documentType: e.target.value }); void patch({ documentType: e.target.value }); }}>{DOCUMENT_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
        </div>
      </section>
      <section className="cs-card content-section">
        <div className="content-section-head">
          <h3>문서 블록</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="cs-btn" onClick={() => addBlock('h2')}>+ 섹션</button>
            <button className="cs-btn" onClick={() => addBlock('paragraph')}>+ 본문</button>
            <button className="cs-btn" onClick={() => addBlock('callout')}>+ 콜아웃</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {project.blocks.map(b => (
            <article key={b.blockId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.type.toUpperCase()}</b><button style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#dc2626' }} onClick={() => removeBlock(b.blockId)}><Trash2 size={14} /></button></div>
              <input value={b.title || ''} onChange={e => updateBlock(b.blockId, { title: e.target.value })} placeholder="블록 제목" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
              <textarea rows={b.type === 'paragraph' ? 6 : 3} value={b.text || ''} onChange={e => updateBlock(b.blockId, { text: e.target.value })} placeholder="내용 입력" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
            </article>
          ))}
          {!project.blocks.length && <p className="content-empty small">블록을 추가해서 문서를 작성해보세요.</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="cs-btn cs-btn-primary" onClick={() => void save()}>저장</button></div>
      </section>
    </div>
  );
}
