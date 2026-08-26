import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ClipboardCopy, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { videoScriptApi } from './videoScriptApi';
import type { ScenePurpose, VideoScene, VideoScriptProject } from './videoScriptTypes';

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fmt = (v?: string) => { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };
const VIDEO_TYPES = ['숏폼 광고', 'UGC', '후기', '인터뷰', '정보형', '제품 소개', '비교', '문제 해결', '브랜드'];
const SCENE_PURPOSES: ScenePurpose[] = ['hook', 'problem', 'solution', 'benefit', 'proof', 'cta', 'other'];

function defaultScenes(): VideoScene[] {
  return [
    { sceneId: uid('scene'), order: 1, startSecond: 0, endSecond: 3, purpose: 'hook', visual: '', narration: '', caption: '' },
    { sceneId: uid('scene'), order: 2, startSecond: 3, endSecond: 10, purpose: 'problem', visual: '', narration: '', caption: '' },
    { sceneId: uid('scene'), order: 3, startSecond: 10, endSecond: 20, purpose: 'solution', visual: '', narration: '', caption: '' },
    { sceneId: uid('scene'), order: 4, startSecond: 20, endSecond: 25, purpose: 'proof', visual: '', narration: '', caption: '' },
    { sceneId: uid('scene'), order: 5, startSecond: 25, endSecond: 30, purpose: 'cta', visual: '', narration: '', caption: '' },
  ];
}

export function VideoScriptPage() {
  const { advertisers, selectedId } = useAdvertiserContext();
  const [params, setParams] = useSearchParams();
  const projectId = params.get('project') || '';
  const [projects, setProjects] = useState<VideoScriptProject[]>([]);
  const [project, setProject] = useState<VideoScriptProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await videoScriptApi.projects(); setProjects(rows);
      if (projectId) { const p = rows.find(x => x.projectId === projectId) || await videoScriptApi.getProject(projectId); setProject(p); } else setProject(null);
    } catch (e) { setNotice(e instanceof Error ? e.message : '영상 대본을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [projectId]);

  const visible = projects.filter(p => (!query || `${p.title} ${p.videoType}`.toLowerCase().includes(query.toLowerCase())) && (!selectedId || p.advertiserId === selectedId));

  const create = async () => {
    const adv = advertisers.find(a => a.id === selectedId);
    if (!adv) { setNotice('먼저 상단에서 광고주를 선택해주세요.'); return; }
    try {
      const row = await videoScriptApi.createProject({ advertiserId: adv.id, advertiserName: adv.name, title: `${adv.name} · 새 영상 대본`, videoType: '숏폼 광고', targetSeconds: 30, ratio: '9:16', cta: '더 알아보기', scenes: defaultScenes() });
      setParams({ project: row.projectId });
    } catch (e) { setNotice(e instanceof Error ? e.message : '새 대본을 만들지 못했습니다.'); }
  };
  const patch = async (changes: Partial<VideoScriptProject>) => {
    if (!project) return;
    try { const next = await videoScriptApi.patchProject(project.projectId, changes); setProject(next); setProjects(rows => rows.map(x => x.projectId === next.projectId ? next : x)); }
    catch (e) { setNotice(e instanceof Error ? e.message : '저장하지 못했습니다.'); }
  };
  const patchLocal = (changes: Partial<VideoScriptProject>) => project && setProject({ ...project, ...changes });
  const save = async () => { if (!project) return; await patch(project); setNotice('저장했습니다.'); };
  const complete = async () => { await patch({ status: 'completed' }); setNotice('완료 처리했습니다.'); };
  const scenes = project?.scenes || [];
  const total = scenes.reduce((n, s) => n + Math.max(0, s.endSecond - s.startSecond), 0);
  const setScene = (id: string, c: Partial<VideoScene>) => patchLocal({ scenes: scenes.map(s => s.sceneId === id ? { ...s, ...c } : s) });
  const remove = async (id: string) => {
    const target = projects.find(x => x.projectId === id);
    if (!confirm(`"${target?.title || '이 대본'}"을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try { await videoScriptApi.deleteProject(id); setProjects(rows => rows.filter(x => x.projectId !== id)); if (project?.projectId === id) setParams({}); setNotice('삭제했습니다.'); }
    catch (e) { setNotice(e instanceof Error ? e.message : '삭제하지 못했습니다.'); }
  };

  if (loading) return <div className="content-system-page"><PageHeader title="영상 대본" description="서버 데이터를 불러오는 중입니다." /></div>;

  if (!project) {
    return (
      <div className="content-system-page">
        <PageHeader title="영상 대본" description="숏폼·광고 영상의 장면별 화면·대사·자막을 시간 구조로 설계합니다." action={<button className="cs-btn cs-btn-primary" onClick={() => void create()}><Plus size={15} /> 새 대본</button>} />
        {notice && <div className="content-notice">{notice}</div>}
        <section className="cs-card content-toolbar"><div className="content-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="대본 제목 검색" /></div></section>
        <section className="content-project-grid">
          {visible.map(p => (
            <article key={p.projectId} className="cs-card content-project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="content-status neutral">{p.videoType}</span><small style={{ color: 'var(--text-muted)' }}>{fmt(p.updatedAt)}</small></div>
              <h3>{p.title}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{p.targetSeconds}초 · {p.ratio}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <button className="cs-btn" style={{ flex: 1 }} onClick={() => setParams({ project: p.projectId })}>대본 열기</button>
                <button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(p.projectId)}><Trash2 size={13} /></button>
              </div>
            </article>
          ))}
          {!visible.length && <div className="content-empty">아직 영상 대본이 없습니다.</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="content-system-page">
      <PageHeader title="영상 대본" description="타임라인 기반 숏폼·광고 영상 대본 에디터" action={<div style={{ display: 'flex', gap: 8 }}><button className="cs-btn" onClick={() => setParams({})}><ChevronLeft size={15} /> 목록</button><button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(project.projectId)}><Trash2 size={15} /> 삭제</button><button className="cs-btn cs-btn-primary" onClick={() => void complete()}><Check size={15} /> 완료 처리</button></div>} />
      {notice && <div className="content-notice">{notice}</div>}

      <section className="cs-card content-section">
        <div className="content-form-grid">
          <label>제목<input value={project.title} onChange={e => patchLocal({ title: e.target.value })} onBlur={() => void save()} /></label>
          <label>광고주<select value={project.advertiserId} onChange={e => { const a = advertisers.find(x => x.id === e.target.value); const c = { advertiserId: e.target.value, advertiserName: a?.name || '' }; patchLocal(c); void patch(c); }}>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>영상 유형<select value={project.videoType} onChange={e => { patchLocal({ videoType: e.target.value }); void patch({ videoType: e.target.value }); }}>{VIDEO_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
          <label>목표 길이(초)<input type="number" min={5} value={project.targetSeconds} onChange={e => patchLocal({ targetSeconds: Number(e.target.value) || 30 })} onBlur={() => void save()} /></label>
          <label>비율<select value={project.ratio} onChange={e => { patchLocal({ ratio: e.target.value }); void patch({ ratio: e.target.value }); }}><option>9:16</option><option>1:1</option><option>16:9</option><option>4:5</option></select></label>
          <label>CTA<input value={project.cta} onChange={e => patchLocal({ cta: e.target.value })} onBlur={() => void save()} /></label>
          <label className="span2">핵심 메시지<input value={project.keyMessage} onChange={e => patchLocal({ keyMessage: e.target.value })} onBlur={() => void save()} /></label>
        </div>
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: total > project.targetSeconds ? '#fef2f2' : '#f0fdf4', color: total > project.targetSeconds ? '#b91c1c' : '#15803d', fontSize: 13, fontWeight: 650 }}>
          장면 합계 {total}초 / 목표 {project.targetSeconds}초{total > project.targetSeconds && ` · ${total - project.targetSeconds}초 초과`}
        </div>
      </section>

      <section className="cs-card content-section">
        <div className="content-section-head"><h3>장면 타임라인</h3><button className="cs-btn" onClick={() => patchLocal({ scenes: [...scenes, { sceneId: uid('scene'), order: scenes.length + 1, startSecond: total, endSecond: total + 5, purpose: 'other', visual: '', narration: '', caption: '' }] })}><Plus size={14} /> 장면 추가</button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scenes.map(s => (
            <article key={s.sceneId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" value={s.startSecond} onChange={e => setScene(s.sceneId, { startSecond: Number(e.target.value) })} style={{ width: 60, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px' }} />
                <span>~</span>
                <input type="number" value={s.endSecond} onChange={e => setScene(s.sceneId, { endSecond: Number(e.target.value) })} style={{ width: 60, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px' }} />
                <b style={{ fontSize: 12 }}>초</b>
                <select value={s.purpose} onChange={e => setScene(s.sceneId, { purpose: e.target.value as ScenePurpose })} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px' }}>{SCENE_PURPOSES.map(v => <option key={v} value={v}>{v}</option>)}</select>
                <button style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: '#dc2626', cursor: 'pointer' }} onClick={() => patchLocal({ scenes: scenes.filter(x => x.sceneId !== s.sceneId).map((x, j) => ({ ...x, order: j + 1 })) })}><Trash2 size={14} /></button>
              </div>
              <input value={s.visual || ''} onChange={e => setScene(s.sceneId, { visual: e.target.value })} placeholder="화면 / 촬영" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
              <textarea rows={2} value={s.narration || ''} onChange={e => setScene(s.sceneId, { narration: e.target.value })} placeholder="대사 / 내레이션" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
              <textarea rows={2} value={s.caption || ''} onChange={e => setScene(s.sceneId, { caption: e.target.value })} placeholder="자막" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
            </article>
          ))}
          {!scenes.length && <p className="content-empty small">장면을 추가해서 대본을 작성해보세요.</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
          <button className="cs-btn" onClick={() => navigator.clipboard?.writeText(scenes.map(s => `${s.startSecond}~${s.endSecond}초 | ${s.narration || ''} | 자막: ${s.caption || ''}`).join('\n'))}><ClipboardCopy size={14} /> 촬영용 텍스트 복사</button>
          <button className="cs-btn cs-btn-primary" onClick={() => void save()}>저장</button>
        </div>
      </section>
    </div>
  );
}
