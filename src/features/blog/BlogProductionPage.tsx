import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ClipboardCopy, FileText, Plus, Save, Search, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { blogApi } from './blogApi';
import { analyzeBlogSeo } from './blogSeoEngine';
import { analyzeCompliance, isMedicalIndustry } from './complianceEngine';
import type { BlogBlock, BlogBlockType, BlogProject } from './blogTypes';

const INDUSTRIES = ['일반 서비스업', '병원·의료기관', '치과', '한의원', '동물병원', '세무사·세무법인', '학원·교육', '자동차·렌트·리스', '식품·쇼핑몰', '부동산', '법률'];
const STATUS_LABEL: Record<string, string> = { draft: '초안', writing: '작성 중', review: '검토 요청', revision: '수정 필요', approved: '승인 완료', 'publish-ready': '발행 대기', published: '발행 완료', archived: '보관' };
const BLOCK_LABEL: Record<BlogBlockType, string> = { paragraph: '본문', h2: '소제목', h3: '소제목 2', list: '목록', quote: '인용문', faq: 'FAQ', cta: 'CTA', divider: '구분선' };
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const split = (value: string) => value.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
const fmt = (value: string) => new Date(value).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export function BlogProductionPage() {
  const { advertisers, selectedId } = useAdvertiserContext();
  const [params, setParams] = useSearchParams();
  const projectId = params.get('project') || '';
  const [projects, setProjects] = useState<BlogProject[]>([]);
  const [project, setProject] = useState<BlogProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; provider: string | null } | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const ps = await blogApi.projects(); setProjects(ps);
      if (projectId) { const p = ps.find(x => x.projectId === projectId) || await blogApi.getProject(projectId); setProject(p); } else setProject(null);
    } catch (e) { setNotice(e instanceof Error ? e.message : '블로그 데이터를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [projectId]);
  useEffect(() => { void blogApi.aiStatus().then(setAiStatus).catch(() => setAiStatus({ configured: false, provider: null })); }, []);

  const filtered = useMemo(() => projects.filter(p => (!query || `${p.selectedTitle} ${p.primaryKeyword} ${p.advertiserName}`.toLowerCase().includes(query.toLowerCase())) && (!selectedId || p.advertiserId === selectedId)), [projects, query, selectedId]);
  const seo = useMemo(() => project ? analyzeBlogSeo(project) : null, [project]);
  const compliance = useMemo(() => project ? analyzeCompliance(project) : [], [project]);

  const create = async () => {
    const adv = advertisers.find(a => a.id === selectedId);
    if (!adv) { setNotice('먼저 상단에서 광고주를 선택해주세요.'); return; }
    try { const row = await blogApi.createProject({ advertiserId: adv.id, advertiserName: adv.name, industry: '일반 서비스업' }); setParams({ project: row.projectId }); }
    catch (e) { setNotice(e instanceof Error ? e.message : '새 글을 만들지 못했습니다.'); }
  };
  const patch = async (changes: Partial<BlogProject>) => {
    if (!project) return;
    try { const next = await blogApi.patchProject(project.projectId, changes); setProject(next); setProjects(rows => rows.map(x => x.projectId === next.projectId ? next : x)); }
    catch (e) { setNotice(e instanceof Error ? e.message : '저장하지 못했습니다.'); }
  };
  const patchLocal = (changes: Partial<BlogProject>) => project && setProject({ ...project, ...changes });
  const save = async () => { if (!project) return; await patch(project); setNotice('서버에 저장했습니다.'); };
  const generate = async () => {
    if (!project?.primaryKeyword) { setNotice('메인 키워드를 먼저 입력하세요.'); return; }
    try {
      const result = await blogApi.generate(project);
      const next = { ...project, titleOptions: result.titles, selectedTitle: result.titles[0] || '', blocks: result.blocks, status: 'writing' as const };
      setProject(next); await blogApi.patchProject(project.projectId, next);
      setNotice('AI가 초안을 생성했습니다.');
    } catch (e) { setNotice(e instanceof Error ? e.message : '초안 생성에 실패했습니다.'); }
  };
  const runReview = async () => {
    if (!project) return;
    const issues = analyzeCompliance(project); const score = analyzeBlogSeo(project).score;
    await patch({ complianceIssues: issues, complianceStatus: issues.some(x => x.severity === 'danger') ? 'revision' : 'reviewed', seoScore: score, status: issues.some(x => x.severity === 'danger') ? 'revision' : 'review' });
    setNotice(`사전점검 완료: ${issues.length}개 확인 항목이 있습니다.`);
  };
  const addBlock = (type: BlogBlockType) => patchLocal({ blocks: [...project!.blocks, { blockId: uid('block'), type, title: type === 'h2' ? '새 소제목' : type === 'faq' ? '자주 묻는 질문' : type === 'cta' ? '안내' : '', text: '' }] });
  const updateBlock = (id: string, change: Partial<BlogBlock>) => patchLocal({ blocks: project!.blocks.map(b => b.blockId === id ? { ...b, ...change } : b) });
  const removeBlock = (id: string) => patchLocal({ blocks: project!.blocks.filter(b => b.blockId !== id) });
  const remove = async (id: string) => {
    const target = projects.find(x => x.projectId === id);
    if (!confirm(`"${target?.selectedTitle || target?.primaryKeyword || '제목 미정'}" 글을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try { await blogApi.deleteProject(id); setProjects(rows => rows.filter(x => x.projectId !== id)); if (project?.projectId === id) setParams({}); setNotice('블로그 글을 삭제했습니다.'); }
    catch (e) { setNotice(e instanceof Error ? e.message : '삭제하지 못했습니다.'); }
  };

  if (loading) return <div className="content-system-page"><PageHeader title="블로그 제작" description="서버 데이터를 불러오는 중입니다." /></div>;

  if (!project) {
    return (
      <div className="content-system-page">
        <PageHeader title="블로그 제작" description="광고주별 콘텐츠를 AI 초안부터 SEO·업종별 규정 검수까지 관리합니다." action={<button className="cs-btn cs-btn-primary" onClick={create}><Plus size={15} /> 새 블로그 제작</button>} />
        {notice && <div className="content-notice">{notice}</div>}
        <section className="cs-card content-toolbar"><div className="content-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목·키워드 검색" /></div></section>
        <section className="cs-card" style={{ padding: 0 }}>
          {filtered.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', fontSize: 12.5, color: 'var(--text-muted)' }}><th style={{ padding: '10px 14px' }}>제목</th><th>광고주</th><th>키워드</th><th>상태</th><th>수정일</th><th /></tr></thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.projectId} style={{ borderTop: '1px solid #eef2f7' }}>
                      <td style={{ padding: '10px 14px' }}><b>{p.selectedTitle || '제목 미정'}</b></td>
                      <td>{p.advertiserName}</td><td>{p.primaryKeyword || '-'}</td>
                      <td><span className={`content-status ${p.status === 'published' || p.status === 'approved' ? 'good' : p.status === 'revision' ? 'bad' : 'neutral'}`}>{STATUS_LABEL[p.status] || p.status}</span></td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{fmt(p.updatedAt)}</td>
                      <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', gap: 6 }}><button className="cs-btn" onClick={() => setParams({ project: p.projectId })}>열기</button><button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(p.projectId)}><Trash2 size={13} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="content-empty">아직 작성한 글이 없습니다.</div>}
        </section>
      </div>
    );
  }

  const medical = isMedicalIndustry(project.industry);
  return (
    <div className="content-system-page">
      <PageHeader title="블로그 제작" description="광고주 정보·SEO·업종별 규정 검수를 한 화면에서 관리합니다." action={<div className="content-header-actions"><button className="cs-btn" onClick={() => setParams({})}><ChevronLeft size={15} /> 목록</button><button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(project.projectId)}><Trash2 size={15} /> 삭제</button><button className="cs-btn cs-btn-primary" onClick={() => void save()}><Save size={15} /> 서버 저장</button></div>} />
      {notice && <div className="content-notice">{notice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 14 }}>
        <aside className="cs-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>제작 설정</h3>
          <label>업종<select value={project.industry} onChange={e => patchLocal({ industry: e.target.value })} style={{ width: '100%' }}>{INDUSTRIES.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>콘텐츠 유형<select value={project.contentType} onChange={e => patchLocal({ contentType: e.target.value })} style={{ width: '100%' }}>{['정보형 블로그', '검색 유입형', '상담 유도형', '브랜드형', 'FAQ형'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label>메인 키워드<input value={project.primaryKeyword} onChange={e => patchLocal({ primaryKeyword: e.target.value })} placeholder="핵심 키워드" style={{ width: '100%' }} /></label>
          <label>서브 키워드<input value={project.secondaryKeywords.join(', ')} onChange={e => patchLocal({ secondaryKeywords: split(e.target.value) })} placeholder="쉼표로 구분" style={{ width: '100%' }} /></label>
          <label>목표 글자수<select value={project.targetLength} onChange={e => patchLocal({ targetLength: Number(e.target.value) })} style={{ width: '100%' }}><option value={1200}>짧게 · 1,200자</option><option value={2000}>일반 · 2,000자</option><option value={3000}>상세 · 3,000자</option></select></label>
          <label>톤앤매너<select value={project.tone} onChange={e => patchLocal({ tone: e.target.value })} style={{ width: '100%' }}><option>광고주 문체 자동 적용</option><option>친절한 전문가형</option><option>정보 중심형</option><option>부드러운 상담형</option></select></label>
          <button className="cs-btn cs-btn-primary" onClick={() => void generate()}><Sparkles size={15} /> AI 초안 만들기</button>
          <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>{aiStatus?.configured ? `외부 AI(${aiStatus.provider})가 초안을 작성합니다.` : 'AI가 아직 연결되지 않았습니다. 관리자에게 BLOG_AI_PROVIDER 설정을 요청하세요.'}</small>
        </aside>

        <main className="cs-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>최종 제목<input value={project.selectedTitle} onChange={e => patchLocal({ selectedTitle: e.target.value })} placeholder="제목을 입력하거나 AI 초안을 생성하세요." style={{ width: '100%' }} /></label>
          {project.titleOptions.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{project.titleOptions.map((title, i) => <button key={`${title}-${i}`} className={`cs-btn ${project.selectedTitle === title ? 'cs-btn-primary' : ''}`} onClick={() => patchLocal({ selectedTitle: title })}>{title}</button>)}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 13 }}>본문 블록</b><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(['paragraph', 'h2', 'h3', 'list', 'quote', 'faq', 'cta', 'divider'] as BlogBlockType[]).map(type => <button key={type} className="cs-btn" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => addBlock(type)}>+ {BLOCK_LABEL[type]}</button>)}</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {project.blocks.length === 0 && <div className="content-empty">왼쪽에서 키워드를 입력하고 초안을 만들거나 블록을 직접 추가하세요.</div>}
            {project.blocks.map(block => (
              <article key={block.blockId} id={`blog-block-${block.blockId}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{BLOCK_LABEL[block.type]}</span><button style={{ border: 0, background: 'transparent', color: '#dc2626', cursor: 'pointer' }} onClick={() => removeBlock(block.blockId)}><Trash2 size={14} /></button></div>
                {block.type === 'divider' ? <hr /> : <>
                  <input value={block.title || ''} onChange={e => updateBlock(block.blockId, { title: e.target.value })} placeholder="블록 제목" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px', marginBottom: 6 }} />
                  <textarea rows={block.type === 'paragraph' ? 6 : 3} value={block.text || ''} onChange={e => updateBlock(block.blockId, { text: e.target.value })} placeholder="내용을 입력하세요." style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
                </>}
              </article>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cs-btn" onClick={() => navigator.clipboard?.writeText(`${project.selectedTitle}\n\n${project.blocks.map(b => `${b.title || ''}\n${b.text || ''}`).join('\n\n')}`)}><ClipboardCopy size={15} /> 전체 복사</button>
            <button className="cs-btn" onClick={() => void runReview()}><ShieldCheck size={15} /> 사전점검 실행</button>
            <button className="cs-btn cs-btn-primary" onClick={() => void save()}><Save size={15} /> 저장</button>
          </div>
        </main>

        <aside className="cs-card" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>SEO 점검</h3>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{seo?.score || 0}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/100</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>{seo?.checks.map(c => <div key={c.label} style={{ display: 'flex', gap: 6, fontSize: 12.5, color: c.ok ? '#15803d' : 'var(--text-muted)' }}><span>{c.ok ? '✓' : '○'}</span>{c.label}</div>)}</div>
          <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>업종별 규정 검수</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>{compliance.filter(x => x.severity === 'danger').length}개 위험 · {compliance.filter(x => x.severity === 'warning').length}개 주의</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {compliance.map(issue => (
              <button key={issue.id} onClick={() => issue.blockId && document.getElementById(`blog-block-${issue.blockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                style={{ textAlign: 'left', border: `1px solid ${issue.severity === 'danger' ? '#fecaca' : issue.severity === 'warning' ? '#fde68a' : '#e0e7ff'}`, background: issue.severity === 'danger' ? '#fef2f2' : issue.severity === 'warning' ? '#fffbeb' : '#eef2ff', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{issue.category}</span><br /><b style={{ fontSize: 12.5 }}>{issue.phrase}</b><br /><small style={{ fontSize: 11, color: 'var(--text-muted)' }}>{issue.reason}</small>
              </button>
            ))}
            {!compliance.length && <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#15803d', fontSize: 12.5 }}><Check size={16} /> 감지된 위험 표현이 없습니다.</div>}
          </div>
          {medical && <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-muted)', background: '#f8fafc', borderRadius: 8, padding: 8 }}>의료 업종은 매체·내용에 따라 사전심의 대상 여부가 달라질 수 있어, 발행 전 담당자 확인이 필요합니다.</p>}
        </aside>
      </div>
    </div>
  );
}
