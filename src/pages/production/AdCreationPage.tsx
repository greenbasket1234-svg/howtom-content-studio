import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Plus, Save, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { createProject, deleteProject, loadProjects, loadTemplates, patchProject, useTemplate, type ContentProject, type CopyVariant } from '../../store/contentStore';

const AD_CHANNELS = ['메타', '네이버 GFA', '네이버 검색', '구글 검색', '유튜브', '당근', '카카오', '틱톡'];
const OBJECTIVES = ['DB 수집', '구매', '트래픽', '상담 신청', '브랜드 인지도', '앱 전환'];
const CREATIVE_TYPES = ['정사각형 이미지', '세로 이미지', '카드뉴스', '세로 영상', '가로 영상', '검색광고 문구', '배너'];
const HOOK_TYPES = ['가격', '혜택', '한정', '희소성', '질문', '문제제기', '후기', '공감', '정보', '비교', '결과', '숫자'];
const CTA_OPTIONS = ['더 알아보기', '상담 신청', '무료 상담', '견적 받기', '구매하기', '예약하기', '다운로드'];
const fmt = (v?: string) => { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };

function emptyVariant(label: string): CopyVariant { return { variantId: `v-${label}-${Math.random().toString(36).slice(2, 6)}`, label, headline: '', description: '', body: '', cta: '더 알아보기' }; }
function charLimit(channel: string, field: 'headline' | 'description') {
  if (channel === '네이버 GFA') return field === 'headline' ? 65 : 28;
  if (channel === '메타') return field === 'headline' ? 40 : 40;
  if (channel.includes('검색')) return field === 'headline' ? 30 : 90;
  return undefined;
}
function Count({ value, max }: { value: string; max?: number }) { return <small style={{ fontSize: 11, color: max && value.length > max ? '#dc2626' : 'var(--text-muted)', alignSelf: 'flex-end' }}>{value.length}{max ? ` / ${max}자` : ''}</small>; }

export function AdCreationPage() {
  const { advertisers, selectedId } = useAdvertiserContext();
  const [params, setParams] = useSearchParams();
  const templates = loadTemplates();
  const [rows, setRows] = useState(() => loadProjects().filter(p => (p.projectType || 'ad') === 'ad'));
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState('');
  const projectId = params.get('project') || '';
  const [draft, setDraft] = useState<ContentProject | undefined>(() => projectId ? loadProjects().find(p => p.projectId === projectId) : undefined);

  useEffect(() => { const id = params.get('project'); setDraft(id ? loadProjects().find(p => p.projectId === id) : undefined); }, [params]);
  const refresh = () => setRows(loadProjects().filter(p => (p.projectType || 'ad') === 'ad'));

  const make = () => {
    const advertiser = advertisers.find(a => a.id === selectedId);
    if (!advertiser) { setNotice('먼저 상단에서 광고주를 선택해주세요.'); return; }
    const p = createProject({
      projectType: 'ad', title: `${advertiser.name} · 새 광고 제작`, advertiserId: advertiser.id, advertiserName: advertiser.name,
      channel: '메타', objective: 'DB 수집', creativeType: '정사각형 이미지', referenceIds: [],
      hooks: ['', '', ''], copyVariants: [emptyVariant('A안'), emptyVariant('B안'), emptyVariant('C안')],
      imagePlan: { visualType: '실사', subject: '', background: '', mainText: '', subText: '', ratio: '1:1', textRatio: '30% 이하' },
      videoPlan: { length: '30초', style: 'UGC / 후기', hook3s: '', scenes: '', endingCta: '더 알아보기' },
      resultAssetIds: [], status: 'draft',
    });
    setParams({ project: p.projectId }); refresh();
  };

  const patch = <K extends keyof ContentProject>(key: K, value: ContentProject[K]) => { if (!draft) return; const n = patchProject(draft.projectId, { [key]: value } as Partial<ContentProject>); if (n) setDraft(n); };
  const patchVariant = (idx: number, field: keyof CopyVariant, value: string) => { if (!draft) return; const copyVariants = draft.copyVariants.map((v, i) => i === idx ? { ...v, [field]: value } : v); patch('copyVariants', copyVariants); };
  const applyTemplate = (templateId: string) => {
    const t = templates.find(x => x.templateId === templateId); if (!t || !draft) return;
    useTemplate(templateId);
    const defaults = t.blocks.map(b => b.defaultValue).filter(Boolean) as string[];
    const copies = [...draft.copyVariants]; if (defaults[0] && !copies[0].headline) copies[0] = { ...copies[0], headline: defaults[0] };
    const n = patchProject(draft.projectId, { templateId: t.templateId, channel: t.channel || draft.channel, hooks: [defaults[0] || draft.hooks[0], draft.hooks[1], draft.hooks[2]], copyVariants: copies });
    if (n) setDraft(n);
    setNotice(`템플릿 '${t.name}'을 적용했습니다.`);
  };
  const complete = () => { if (!draft) return; patch('status', 'completed'); setNotice('제작 완료 처리했습니다.'); refresh(); };
  const remove = (id: string) => {
    if (!confirm('이 광고 제작 프로젝트를 삭제할까요? 되돌릴 수 없습니다.')) return;
    deleteProject(id);
    if (draft?.projectId === id) setParams({});
    refresh();
    setNotice('삭제했습니다.');
  };

  if (!draft) {
    const visible = rows.filter(p => (!q || [p.title, p.advertiserName, p.channel].join(' ').toLowerCase().includes(q.toLowerCase())) && (!selectedId || p.advertiserId === selectedId));
    return (
      <div className="content-system-page">
        <PageHeader title="광고 제작" description="브리프·후킹·카피·CTA·이미지/영상 기획을 한 화면에서 제작합니다." action={<button className="cs-btn cs-btn-primary" onClick={make}><Plus size={15} /> 새 광고 제작</button>} />
        {notice && <div className="content-notice">{notice}</div>}
        <section className="cs-card content-toolbar"><div className="content-search"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="프로젝트명·매체 검색" /></div></section>
        <section className="content-project-grid">
          {visible.map(p => (
            <article key={p.projectId} className="cs-card content-project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className={`content-status ${p.status === 'completed' ? 'good' : 'neutral'}`}>{p.status === 'completed' ? '제작 완료' : '초안'}</span><small style={{ color: 'var(--text-muted)' }}>{fmt(p.updatedAt)}</small></div>
              <h3 style={{ margin: '6px 0 0', fontSize: 14.5 }}>{p.title}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{p.advertiserName} · {p.channel} · {p.creativeType}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <button className="cs-btn" style={{ flex: 1 }} onClick={() => setParams({ project: p.projectId })}>열기</button>
                <button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(p.projectId)}><Trash2 size={13} /></button>
              </div>
            </article>
          ))}
          {!visible.length && <div className="content-empty">아직 저장된 광고 제작 프로젝트가 없습니다.</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="content-system-page">
      <PageHeader title="광고 제작" description="브리프·레퍼런스·후킹·카피·CTA·이미지/영상 기획을 한 화면에서 제작합니다." action={<div className="content-header-actions"><button className="cs-btn" onClick={() => setParams({})}>목록</button><button className="cs-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(draft.projectId)}><Trash2 size={15} /> 삭제</button><button className="cs-btn cs-btn-primary" onClick={complete}><Check size={15} /> 제작 완료</button></div>} />
      {notice && <div className="content-notice">{notice}</div>}

      <section className="cs-card content-section">
        <div className="content-section-head"><div><span>01</span><h3>제작 브리프</h3></div><small>광고 목적과 제약조건을 먼저 고정합니다.</small></div>
        <div className="content-form-grid four">
          <label>프로젝트명<input value={draft.title} onChange={e => patch('title', e.target.value)} /></label>
          <label>광고주<select value={draft.advertiserId} onChange={e => { const a = advertisers.find(x => x.id === e.target.value); patch('advertiserId', e.target.value); patch('advertiserName', a?.name || ''); }}>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>매체<select value={draft.channel} onChange={e => patch('channel', e.target.value)}>{AD_CHANNELS.map(v => <option key={v}>{v}</option>)}</select></label>
          <label>캠페인<input value={draft.campaignName || ''} onChange={e => patch('campaignName', e.target.value)} /></label>
          <label>광고 목적<select value={draft.objective} onChange={e => patch('objective', e.target.value)}>{OBJECTIVES.map(v => <option key={v}>{v}</option>)}</select></label>
          <label>소재 유형<select value={draft.creativeType} onChange={e => patch('creativeType', e.target.value)}>{CREATIVE_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
          <label>대표 KPI<input value={draft.representativeKpi || ''} onChange={e => patch('representativeKpi', e.target.value)} placeholder="DB당 비용, ROAS 등" /></label>
          <label>타겟<input value={draft.target || ''} onChange={e => patch('target', e.target.value)} /></label>
          <label>핵심 혜택<input value={draft.keyBenefit || ''} onChange={e => patch('keyBenefit', e.target.value)} /></label>
          <label>가격<input value={draft.price || ''} onChange={e => patch('price', e.target.value)} /></label>
          <label>소재 규격<input value={draft.format || ''} onChange={e => patch('format', e.target.value)} placeholder="1:1 / 9:16" /></label>
          <label>랜딩 URL<input value={draft.landingUrl || ''} onChange={e => patch('landingUrl', e.target.value)} /></label>
          <label className="span2">필수 문구<textarea value={draft.mandatoryText || ''} onChange={e => patch('mandatoryText', e.target.value)} rows={2} /></label>
          <label className="span2">금지 문구<textarea value={draft.prohibitedText || ''} onChange={e => patch('prohibitedText', e.target.value)} rows={2} /></label>
        </div>
      </section>

      <section className="cs-card content-section">
        <div className="content-section-head"><div><span>02</span><h3>템플릿</h3></div></div>
        <div className="content-template-picker">
          {templates.filter(t => !t.advertiserId || t.advertiserId === draft.advertiserId).slice(0, 8).map(t => (
            <button key={t.templateId} className={draft.templateId === t.templateId ? 'selected' : ''} onClick={() => applyTemplate(t.templateId)}>
              <b>{t.name}</b><small style={{ color: 'var(--text-muted)' }}>{t.templateType}{t.channel ? ` · ${t.channel}` : ''}</small><span style={{ fontSize: 11 }}>v{t.version} · 사용 {t.useCount}회</span>
            </button>
          ))}
          {!templates.length && <p className="content-empty small">저장된 템플릿이 없습니다. "템플릿" 메뉴에서 먼저 만들어보세요.</p>}
        </div>
      </section>

      <section className="cs-card content-section">
        <div className="content-section-head"><div><span>03</span><h3>후킹</h3></div><small>서로 다른 가설을 A/B/C로 준비합니다.</small></div>
        <div className="content-hook-types">{HOOK_TYPES.map(v => <button key={v} className={draft.hookType === v ? 'active' : ''} onClick={() => patch('hookType', v)}>{v}</button>)}</div>
        <div className="content-hook-grid">{draft.hooks.map((v, i) => <label key={i}>{String.fromCharCode(65 + i)}안<textarea value={v} onChange={e => { const hooks = draft.hooks.map((x, j) => j === i ? e.target.value : x); patch('hooks', hooks); }} rows={3} placeholder={`${draft.hookType || '후킹'} 문구`} /><Count value={v} /></label>)}</div>
      </section>

      <section className="cs-card content-section">
        <div className="content-section-head"><div><span>04</span><h3>광고 카피 · CTA</h3></div><small>매체 규격에 따라 글자수를 확인합니다.</small></div>
        <div className="content-copy-variants">
          {draft.copyVariants.map((v, i) => { const hmax = charLimit(draft.channel, 'headline'), dmax = charLimit(draft.channel, 'description'); return (
            <article key={v.variantId}>
              <div className="content-copy-head"><b>{v.label}</b><input value={v.angle || ''} onChange={e => patchVariant(i, 'angle', e.target.value)} placeholder="가격 강조 / 후기 강조" /></div>
              <label>제목<input value={v.headline} onChange={e => patchVariant(i, 'headline', e.target.value)} /><Count value={v.headline} max={hmax} /></label>
              <label>설명<input value={v.description} onChange={e => patchVariant(i, 'description', e.target.value)} /><Count value={v.description} max={dmax} /></label>
              <label>본문<textarea rows={5} value={v.body} onChange={e => patchVariant(i, 'body', e.target.value)} /><Count value={v.body} /></label>
              <label>CTA<select value={v.cta} onChange={e => patchVariant(i, 'cta', e.target.value)}>{CTA_OPTIONS.map(x => <option key={x}>{x}</option>)}</select></label>
            </article>
          ); })}
        </div>
      </section>

      <div className="content-two-col">
        <section className="cs-card content-section">
          <div className="content-section-head"><div><span>05</span><h3>이미지 소재 기획</h3></div></div>
          <div className="content-form-grid">
            <label>표현 방식<input value={draft.imagePlan?.visualType || ''} onChange={e => patch('imagePlan', { ...draft.imagePlan, visualType: e.target.value })} /></label>
            <label>메인 피사체<input value={draft.imagePlan?.subject || ''} onChange={e => patch('imagePlan', { ...draft.imagePlan, subject: e.target.value })} /></label>
            <label>배경<input value={draft.imagePlan?.background || ''} onChange={e => patch('imagePlan', { ...draft.imagePlan, background: e.target.value })} /></label>
            <label>비율<input value={draft.imagePlan?.ratio || ''} onChange={e => patch('imagePlan', { ...draft.imagePlan, ratio: e.target.value })} /></label>
            <label className="span2">메인 문구<input value={draft.imagePlan?.mainText || ''} onChange={e => patch('imagePlan', { ...draft.imagePlan, mainText: e.target.value })} /></label>
            <label className="span2">서브 문구<input value={draft.imagePlan?.subText || ''} onChange={e => patch('imagePlan', { ...draft.imagePlan, subText: e.target.value })} /></label>
          </div>
        </section>
        <section className="cs-card content-section">
          <div className="content-section-head"><div><span>06</span><h3>영상 소재 기획</h3></div></div>
          <div className="content-form-grid">
            <label>영상 길이<input value={draft.videoPlan?.length || ''} onChange={e => patch('videoPlan', { ...draft.videoPlan, length: e.target.value })} /></label>
            <label>영상 유형<input value={draft.videoPlan?.style || ''} onChange={e => patch('videoPlan', { ...draft.videoPlan, style: e.target.value })} /></label>
            <label className="span2">첫 3초 후킹<textarea rows={2} value={draft.videoPlan?.hook3s || ''} onChange={e => patch('videoPlan', { ...draft.videoPlan, hook3s: e.target.value })} /></label>
            <label className="span2">장면 구성<textarea rows={5} value={draft.videoPlan?.scenes || ''} onChange={e => patch('videoPlan', { ...draft.videoPlan, scenes: e.target.value })} placeholder={'장면 1\n장면 2\n장면 3'} /></label>
            <label className="span2">마지막 CTA<input value={draft.videoPlan?.endingCta || ''} onChange={e => patch('videoPlan', { ...draft.videoPlan, endingCta: e.target.value })} /></label>
          </div>
        </section>
      </div>

      <section className="cs-card content-section">
        <div className="content-final-actions"><button className="cs-btn" onClick={() => setNotice('저장했습니다.')}><Save size={15} /> 임시 저장</button><button className="cs-btn cs-btn-primary" onClick={complete}><Check size={15} /> 제작 완료</button></div>
      </section>
    </div>
  );
}
