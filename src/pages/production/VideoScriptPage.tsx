import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ClipboardCopy, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { createProject, deleteProject, loadProjects, patchProject, type ContentProject, type VideoScriptScene } from '../../store/contentStore';

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fmt = (v?: string) => { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };
const VIDEO_TYPES = ['숏폼 광고', 'UGC', '후기', '인터뷰', '정보형', '제품 소개', '비교', '문제 해결', '브랜드'];
const SCENE_PURPOSES: VideoScriptScene['purpose'][] = ['hook', 'problem', 'solution', 'benefit', 'proof', 'cta', 'other'];

function defaultScenes(): VideoScriptScene[] {
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
  const [rows, setRows] = useState(() => loadProjects().filter(p => p.projectType === 'video-script'));
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState('');
  const projectId = params.get('project') || '';
  const [draft, setDraft] = useState<ContentProject | undefined>(() => projectId ? loadProjects().find(p => p.projectId === projectId) : undefined);

  useEffect(() => { const id = params.get('project'); setDraft(id ? loadProjects().find(p => p.projectId === id) : undefined); }, [params]);
  const refresh = () => setRows(loadProjects().filter(p => p.projectType === 'video-script'));

  const make = () => {
    const advertiser = advertisers.find(a => a.id === selectedId);
    if (!advertiser) { setNotice('먼저 상단에서 광고주를 선택해주세요.'); return; }
    const p = createProject({
      projectType: 'video-script', title: `${advertiser.name} · 새 영상 대본`, advertiserId: advertiser.id, advertiserName: advertiser.name,
      channel: '메타', objective: '영상 광고', creativeType: '영상 대본', referenceIds: [], hooks: [], copyVariants: [], resultAssetIds: [], status: 'draft',
      videoScriptData: { videoType: '숏폼 광고', targetSeconds: 30, ratio: '9:16', targetAudience: '', keyMessage: '', cta: '더 알아보기', scenes: defaultScenes() },
    });
    setParams({ project: p.projectId }); refresh();
  };
  const patch = (c: Partial<ContentProject>) => { if (!draft) return; const n = patchProject(draft.projectId, c); if (n) setDraft(n); };
  const patchData = (c: Partial<NonNullable<ContentProject['videoScriptData']>>) => patch({ videoScriptData: { ...(draft?.videoScriptData || {}), ...c } });
  const scenes = draft?.videoScriptData?.scenes || [];
  const total = scenes.reduce((n, s) => n + Math.max(0, s.endSecond - s.startSecond), 0);
  const setScene = (id: string, c: Partial<VideoScriptScene>) => patchData({ scenes: scenes.map(s => s.sceneId === id ? { ...s, ...c } : s) });

  const complete = () => { if (!draft) return; patch({ status: 'completed' }); setNotice('영상 대본을 완료 처리했습니다.'); refresh(); };
  const remove = (id: string) => {
    if (!confirm('이 영상 대본을 삭제할까요? 되돌릴 수 없습니다.')) return;
    deleteProject(id);
    if (draft?.projectId === id) setParams({});
    refresh();
    setNotice('삭제했습니다.');
  };

  if (!draft) {
    const visible = rows.filter(p => (!q || [p.title, p.advertiserName, p.videoScriptData?.videoType].join(' ').toLowerCase().includes(q.toLowerCase())) && (!selectedId || p.advertiserId === selectedId));
    return (
      <div className="content-system-page">
        <PageHeader title="영상 대본" description="숏폼·광고 영상의 장면별 화면·대사·자막을 시간 구조로 설계합니다." action={<button className="cs-btn cs-btn-primary" onClick={make}><Plus size={15} /> 새 대본</button>} />
        {notice && <div className="content-notice">{notice}</div>}
        <section className="cs-card content-toolbar"><div className="content-search"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="대본 제목 검색" /></div></section>
        <section className="content-project-grid">
          {visible.map(p => (
            <article key={p.projectId} className="cs-card content-project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="content-status neutral">{p.videoScriptData?.videoType || '영상'}</span><small style={{ color: 'var(--text-muted)' }}>{fmt(p.updatedAt)}</small></div>
              <h3 style={{ margin: '6px 0 0', fontSize: 14.5 }}>{p.title}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{p.videoScriptData?.targetSeconds || 30}초 · {p.videoScriptData?.ratio || '9:16'}</p>
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
      <PageHeader title="영상 대본" description="타임라인 기반 숏폼·광고 영상 대본 에디터" action={<div className="content-header-actions"><button className="cs-btn" onClick={() => setParams({})}>목록</button><button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(draft.projectId)}><Trash2 size={15} /> 삭제</button><button className="cs-btn cs-btn-primary" onClick={complete}><Check size={15} /> 제작 완료</button></div>} />
      {notice && <div className="content-notice">{notice}</div>}

      <section className="cs-card content-section">
        <div className="content-form-grid">
          <label>제목<input value={draft.title} onChange={e => patch({ title: e.target.value })} /></label>
          <label>광고주<select value={draft.advertiserId} onChange={e => { const a = advertisers.find(x => x.id === e.target.value); patch({ advertiserId: e.target.value, advertiserName: a?.name || '' }); }}>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>영상 유형<select value={draft.videoScriptData?.videoType || '숏폼 광고'} onChange={e => patchData({ videoType: e.target.value })}>{VIDEO_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
          <label>목표 길이(초)<input type="number" min={5} value={draft.videoScriptData?.targetSeconds || 30} onChange={e => patchData({ targetSeconds: Number(e.target.value) || 30 })} /></label>
          <label>비율<select value={draft.videoScriptData?.ratio || '9:16'} onChange={e => patchData({ ratio: e.target.value })}><option>9:16</option><option>1:1</option><option>16:9</option><option>4:5</option></select></label>
          <label>CTA<input value={draft.videoScriptData?.cta || ''} onChange={e => patchData({ cta: e.target.value })} /></label>
          <label className="span2">핵심 메시지<input value={draft.videoScriptData?.keyMessage || ''} onChange={e => patchData({ keyMessage: e.target.value })} /></label>
        </div>
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: total > (draft.videoScriptData?.targetSeconds || 30) ? '#fef2f2' : '#f0fdf4', color: total > (draft.videoScriptData?.targetSeconds || 30) ? '#b91c1c' : '#15803d', fontSize: 13, fontWeight: 650 }}>
          장면 합계 {total}초 / 목표 {draft.videoScriptData?.targetSeconds || 30}초{total > (draft.videoScriptData?.targetSeconds || 30) && ` · ${total - (draft.videoScriptData?.targetSeconds || 30)}초 초과`}
        </div>
      </section>

      <section className="cs-card content-section">
        <div className="content-section-head"><h3>장면 타임라인</h3><button className="cs-btn" onClick={() => patchData({ scenes: [...scenes, { sceneId: uid('scene'), order: scenes.length + 1, startSecond: total, endSecond: total + 5, purpose: 'other', visual: '', narration: '', caption: '' }] })}><Plus size={14} /> 장면 추가</button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scenes.map(s => (
            <article key={s.sceneId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" value={s.startSecond} onChange={e => setScene(s.sceneId, { startSecond: Number(e.target.value) })} style={{ width: 60, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px' }} />
                <span>~</span>
                <input type="number" value={s.endSecond} onChange={e => setScene(s.sceneId, { endSecond: Number(e.target.value) })} style={{ width: 60, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px' }} />
                <b style={{ fontSize: 12 }}>초</b>
                <select value={s.purpose} onChange={e => setScene(s.sceneId, { purpose: e.target.value as VideoScriptScene['purpose'] })} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px' }}>{SCENE_PURPOSES.map(v => <option key={v} value={v}>{v}</option>)}</select>
                <button style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: '#dc2626', cursor: 'pointer' }} onClick={() => patchData({ scenes: scenes.filter(x => x.sceneId !== s.sceneId).map((x, j) => ({ ...x, order: j + 1 })) })}><Trash2 size={14} /></button>
              </div>
              <input value={s.visual || ''} onChange={e => setScene(s.sceneId, { visual: e.target.value })} placeholder="화면 / 촬영" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
              <textarea rows={2} value={s.narration || ''} onChange={e => setScene(s.sceneId, { narration: e.target.value })} placeholder="대사 / 내레이션" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
              <textarea rows={2} value={s.caption || ''} onChange={e => setScene(s.sceneId, { caption: e.target.value })} placeholder="자막" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }} />
            </article>
          ))}
          {!scenes.length && <p className="content-empty small">장면을 추가해서 대본을 작성해보세요.</p>}
        </div>
      </section>

      <section className="cs-card content-section">
        <button className="cs-btn" onClick={() => navigator.clipboard?.writeText(scenes.map(s => `${s.startSecond}~${s.endSecond}초 | ${s.narration || ''} | 자막: ${s.caption || ''}`).join('\n'))}><ClipboardCopy size={14} /> 촬영용 텍스트 복사</button>
      </section>
    </div>
  );
}
