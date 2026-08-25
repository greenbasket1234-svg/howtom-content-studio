import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive, Check, ChevronRight, Copy, FileText, Image as ImageIcon, Plus, Save, Search,
  Trash2, Video
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { adApi } from './adApi';
import type { AdCopyVariant, AdProject, AdProjectStatus } from './adTypes';

const AD_CHANNELS = ['메타','네이버 GFA','네이버 검색','구글 검색','유튜브','당근','카카오','틱톡'];
const OBJECTIVES = ['DB 수집','구매','트래픽','상담 신청','브랜드 인지도','앱 전환'];
const CREATIVE_TYPES = ['정사각형 이미지','세로 이미지','카드뉴스','세로 영상','가로 영상','검색광고 문구','배너'];
const HOOK_TYPES = ['가격','혜택','한정','희소성','질문','문제제기','후기','공감','정보','비교','결과','숫자'];
const CTA_OPTIONS = ['더 알아보기','상담 신청','무료 상담','견적 받기','구매하기','예약하기','다운로드'];
const STATUS_LABEL: Record<AdProjectStatus,string> = {
  draft:'초안','in-progress':'제작 중',review:'검토 요청',completed:'제작 완료',archived:'보관'
};
const STATUS_TONE: Record<AdProjectStatus,string> = {
  draft:'neutral','in-progress':'neutral',review:'warning',completed:'success',archived:'muted'
};

const uid = (prefix:string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const now = () => new Date().toISOString();
const fmt = (value:string) => new Date(value).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const emptyVariant = (label:string):AdCopyVariant => ({ variantId:uid('variant'), label, headline:'', description:'', body:'', cta:'더 알아보기' });

function charLimit(channel:string, field:'headline'|'description') {
  if (channel === '네이버 GFA') return field === 'headline' ? 65 : 28;
  if (channel === '메타') return 40;
  if (channel.includes('검색')) return field === 'headline' ? 30 : 90;
  return undefined;
}

function Count({ value, max }: { value:string; max?:number }) {
  return <small className={max && value.length > max ? 'ad26-count over' : 'ad26-count'}>{value.length}{max ? ` / ${max}자` : '자'}</small>;
}

function blankProject(advertiserId = '', advertiserName = ''): AdProject {
  const stamp = now();
  return {
    projectId:'', title:'새 광고 제작', advertiserId, advertiserName, channel:'메타', objective:'DB 수집',
    creativeType:'정사각형 이미지', representativeKpi:'DB당 비용', target:'', keyBenefit:'', price:'', mandatoryText:'',
    prohibitedText:'', landingUrl:'', format:'1:1', hookType:'', hooks:['','',''],
    copyVariants:[emptyVariant('A안'),emptyVariant('B안'),emptyVariant('C안')],
    imagePlan:{visualType:'실사',subject:'',background:'',mainText:'',subText:'',ratio:'1:1',textRatio:'30% 이하'},
    videoPlan:{length:'30초',style:'UGC / 후기',hook3s:'',scenes:'',endingCta:'더 알아보기'},
    referenceIds:[], resultAssetIds:[], status:'draft', createdAt:stamp, updatedAt:stamp,
  };
}

export function AdCreationPage() {
  const { advertisers, selectedId: globalAdvertiserId, isAllSelected } = useAdvertiserContext();
  const [params,setParams] = useSearchParams();
  const projectId = params.get('project') || '';
  const [projects,setProjects] = useState<AdProject[]>([]);
  const [draft,setDraft] = useState<AdProject>(() => blankProject());
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState('');
  const [query,setQuery] = useState('');
  const [statusFilter,setStatusFilter] = useState<'all'|AdProjectStatus>('all');

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(p => {
      const inAdvertiserScope = isAllSelected || p.advertiserId === globalAdvertiserId;
      const inStatus = statusFilter === 'all' || p.status === statusFilter;
      const inQuery = !q || [p.title,p.advertiserName,p.channel,p.objective,p.creativeType,p.target,p.keyBenefit].join(' ').toLowerCase().includes(q);
      return inAdvertiserScope && inStatus && inQuery;
    });
  }, [projects,query,statusFilter,isAllSelected,globalAdvertiserId]);

  const projectCounts = useMemo(() => ({
    total: projects.filter(p=>isAllSelected || p.advertiserId===globalAdvertiserId).length,
    draft: projects.filter(p=>(isAllSelected || p.advertiserId===globalAdvertiserId) && p.status==='draft').length,
    review: projects.filter(p=>(isAllSelected || p.advertiserId===globalAdvertiserId) && p.status==='review').length,
    completed: projects.filter(p=>(isAllSelected || p.advertiserId===globalAdvertiserId) && p.status==='completed').length,
  }),[projects,isAllSelected,globalAdvertiserId]);

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await adApi.projects();
      setProjects(rows);
      if (projectId) {
        const current = rows.find(x=>x.projectId===projectId) || await adApi.getProject(projectId);
        setDraft(current);
      } else {
        const adv = isAllSelected ? null : advertisers.find(a=>a.id===globalAdvertiserId) || null;
        setDraft(blankProject(adv?.id || '', adv?.name || ''));
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '광고 제작 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },[projectId]);
  useEffect(()=>{
    if (projectId || isAllSelected) return;
    const adv = advertisers.find(a=>a.id===globalAdvertiserId);
    if (adv && !draft.projectId) setDraft(prev=>({...prev,advertiserId:adv.id,advertiserName:adv.name}));
  },[globalAdvertiserId,isAllSelected,advertisers,projectId,draft.projectId]);

  const patch = <K extends keyof AdProject>(key:K,value:AdProject[K]) => {
    setDraft(prev=>{
      const next = {...prev,[key]:value,updatedAt:now()};
      if (key === 'advertiserId') next.advertiserName = advertisers.find(a=>a.id===String(value))?.name || '';
      return next;
    });
  };
  const patchVariant = (index:number, field:keyof AdCopyVariant, value:string) => {
    setDraft(prev=>({...prev,copyVariants:prev.copyVariants.map((v,i)=>i===index?{...v,[field]:value}:v),updatedAt:now()}));
  };

  const newProject = () => {
    const adv = isAllSelected ? null : advertisers.find(a=>a.id===globalAdvertiserId) || null;
    setParams({});
    setDraft(blankProject(adv?.id || '',adv?.name || ''));
    setNotice('새 광고 제작 프로젝트를 시작합니다.');
  };

  const save = async (status?:AdProjectStatus) => {
    if (!draft.advertiserId) { setNotice('광고주를 먼저 선택하세요.'); return null; }
    setSaving(true);
    try {
      const payload = {...draft,status:status || draft.status,updatedAt:now()};
      const row = draft.projectId ? await adApi.patchProject(draft.projectId,payload) : await adApi.createProject(payload);
      setDraft(row);
      setProjects(prev=>prev.some(p=>p.projectId===row.projectId)?prev.map(p=>p.projectId===row.projectId?row:p):[row,...prev]);
      setParams({project:row.projectId});
      setNotice(status==='completed'?'제작 완료로 저장했습니다.':'광고 제작 프로젝트를 저장했습니다.');
      return row;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '저장하지 못했습니다.');
      return null;
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!draft.projectId) { newProject(); return; }
    if (!window.confirm('이 광고 제작 프로젝트를 삭제할까요?')) return;
    try {
      await adApi.deleteProject(draft.projectId);
      setProjects(prev=>prev.filter(p=>p.projectId!==draft.projectId));
      setParams({});
      const adv = isAllSelected ? null : advertisers.find(a=>a.id===globalAdvertiserId) || null;
      setDraft(blankProject(adv?.id || '',adv?.name || ''));
      setNotice('광고 제작 프로젝트를 삭제했습니다.');
    } catch(e) { setNotice(e instanceof Error?e.message:'삭제하지 못했습니다.'); }
  };

  const duplicate = () => {
    const copy = {...draft,projectId:'',title:`${draft.title || '광고 제작'} 복제`,status:'draft' as AdProjectStatus,createdAt:now(),updatedAt:now(),copyVariants:draft.copyVariants.map(v=>({...v,variantId:uid('variant')}))};
    setParams({}); setDraft(copy); setNotice('복제본을 만들었습니다. 저장하면 새 프로젝트가 생성됩니다.');
  };

  const headlineMax = charLimit(draft.channel,'headline');
  const descriptionMax = charLimit(draft.channel,'description');
  const isVideo = draft.creativeType.includes('영상');

  return <div className="ad26-page">
    <PageHeader title="광고 제작" description="광고 브리프·후킹·카피·CTA·이미지/영상 기획을 한 화면에서 작성하고 광고주별로 저장합니다." action={<div className="ad26-header-actions"><button className="btn secondary" onClick={newProject}><Plus size={15}/> 새 광고</button><button className="btn secondary" disabled={saving} onClick={()=>void save()}><Save size={15}/> 임시 저장</button><button className="btn primary" disabled={saving} onClick={()=>void save('completed')}><Check size={15}/> 제작 완료</button></div>} />
    {notice && <div className="ad26-notice">{notice}</div>}

    <section className="ad26-kpis">
      <article><span>현재 범위</span><b>{isAllSelected?'전체 광고주':advertisers.find(a=>a.id===globalAdvertiserId)?.name || '-'}</b></article>
      <article><span>광고 제작</span><b>{projectCounts.total}</b></article>
      <article><span>초안</span><b>{projectCounts.draft}</b></article>
      <article><span>검토 요청</span><b>{projectCounts.review}</b></article>
      <article><span>제작 완료</span><b>{projectCounts.completed}</b></article>
    </section>

    <div className="ad26-layout">
      <aside className="card ad26-projects">
        <div className="ad26-panel-head"><div><h3>광고 프로젝트</h3><small>{filteredProjects.length}개 표시</small></div><button className="btn mini" onClick={newProject}><Plus size={13}/></button></div>
        <div className="ad26-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="프로젝트 검색"/></div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as 'all'|AdProjectStatus)}><option value="all">전체 상태</option>{Object.entries(STATUS_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        <div className="ad26-project-list">
          {loading && <p className="ad26-empty">불러오는 중...</p>}
          {!loading && filteredProjects.map(p=><button key={p.projectId} className={p.projectId===draft.projectId?'active':''} onClick={()=>setParams({project:p.projectId})}>
            <div><span className={`ad26-status ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span><small>{fmt(p.updatedAt)}</small></div>
            <b>{p.title || '제목 미정'}</b><span>{p.advertiserName} · {p.channel}</span><ChevronRight size={14}/>
          </button>)}
          {!loading && !filteredProjects.length && <p className="ad26-empty">저장된 광고 제작 프로젝트가 없습니다.</p>}
        </div>
      </aside>

      <main className="ad26-editor">
        <section className="card ad26-section">
          <div className="ad26-section-head"><div><span>STEP 1</span><h3>제작 브리프</h3></div><div className="ad26-inline-actions"><button className="btn mini" onClick={duplicate}><Copy size={13}/> 복제</button><button className="btn mini danger" onClick={()=>void remove()}><Trash2 size={13}/> 삭제</button></div></div>
          <div className="ad26-form-grid">
            <label className="span2">프로젝트 제목<input value={draft.title} onChange={e=>patch('title',e.target.value)} placeholder="예: 9월 BMW 가격 소구 메타 광고"/></label>
            <label>광고주<select value={draft.advertiserId} onChange={e=>patch('advertiserId',e.target.value)}><option value="">광고주 선택</option>{advertisers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <label>상태<select value={draft.status} onChange={e=>patch('status',e.target.value as AdProjectStatus)}>{Object.entries(STATUS_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label>매체<select value={draft.channel} onChange={e=>patch('channel',e.target.value)}>{AD_CHANNELS.map(v=><option key={v}>{v}</option>)}</select></label>
            <label>목적<select value={draft.objective} onChange={e=>patch('objective',e.target.value)}>{OBJECTIVES.map(v=><option key={v}>{v}</option>)}</select></label>
            <label>소재 유형<select value={draft.creativeType} onChange={e=>patch('creativeType',e.target.value)}>{CREATIVE_TYPES.map(v=><option key={v}>{v}</option>)}</select></label>
            <label>대표 KPI<input value={draft.representativeKpi} onChange={e=>patch('representativeKpi',e.target.value)} placeholder="DB당 비용, CTR, ROAS 등"/></label>
            <label className="span2">타겟<input value={draft.target} onChange={e=>patch('target',e.target.value)} placeholder="예: 30~50대 수입차 장기렌트 관심 고객"/></label>
            <label>핵심 혜택<input value={draft.keyBenefit} onChange={e=>patch('keyBenefit',e.target.value)} placeholder="예: 초기비용 없음"/></label>
            <label>가격/조건<input value={draft.price} onChange={e=>patch('price',e.target.value)} placeholder="예: 월 39만원대"/></label>
            <label className="span2">랜딩 URL<input value={draft.landingUrl} onChange={e=>patch('landingUrl',e.target.value)} placeholder="https://"/></label>
            <label className="span2">필수 문구<textarea rows={2} value={draft.mandatoryText} onChange={e=>patch('mandatoryText',e.target.value)} placeholder="광고에 반드시 들어가야 하는 문구"/></label>
            <label className="span2">금지 문구<textarea rows={2} value={draft.prohibitedText} onChange={e=>patch('prohibitedText',e.target.value)} placeholder="사용하지 말아야 하는 표현"/></label>
          </div>
        </section>

        <section className="card ad26-section">
          <div className="ad26-section-head"><div><span>STEP 2</span><h3>후킹</h3><p>AI 생성 없이 실제 사용할 후킹을 직접 작성합니다.</p></div></div>
          <div className="ad26-hook-type-row">{HOOK_TYPES.map(type=><button key={type} className={draft.hookType===type?'active':''} onClick={()=>patch('hookType',type)}>{type}</button>)}</div>
          <div className="ad26-hook-grid">{draft.hooks.map((hook,index)=><label key={index}><span>{String.fromCharCode(65+index)}안 후킹</span><textarea rows={3} value={hook} onChange={e=>patch('hooks',draft.hooks.map((v,i)=>i===index?e.target.value:v))} placeholder="첫 문장에서 시선을 잡을 문구"/></label>)}</div>
        </section>

        <section className="card ad26-section">
          <div className="ad26-section-head"><div><span>STEP 3</span><h3>광고 카피 3안</h3><p>{draft.channel} 기준으로 제목·설명 글자수를 확인합니다.</p></div></div>
          <div className="ad26-copy-grid">{draft.copyVariants.map((variant,index)=><article key={variant.variantId}>
            <header><b>{variant.label}</b><span>{draft.channel}</span></header>
            <label>제목<input value={variant.headline} onChange={e=>patchVariant(index,'headline',e.target.value)}/><Count value={variant.headline} max={headlineMax}/></label>
            <label>설명<input value={variant.description} onChange={e=>patchVariant(index,'description',e.target.value)}/><Count value={variant.description} max={descriptionMax}/></label>
            <label>본문<textarea rows={6} value={variant.body} onChange={e=>patchVariant(index,'body',e.target.value)}/><Count value={variant.body}/></label>
            <label>CTA<select value={variant.cta} onChange={e=>patchVariant(index,'cta',e.target.value)}>{CTA_OPTIONS.map(v=><option key={v}>{v}</option>)}</select></label>
          </article>)}</div>
        </section>

        <section className="card ad26-section">
          <div className="ad26-section-head"><div><span>STEP 4</span><h3>{isVideo?'영상 기획':'이미지 기획'}</h3></div><div className="ad26-type-badge">{isVideo?<Video size={15}/>:<ImageIcon size={15}/>} {draft.creativeType}</div></div>
          {!isVideo ? <div className="ad26-form-grid">
            <label>비주얼 유형<input value={draft.imagePlan.visualType} onChange={e=>patch('imagePlan',{...draft.imagePlan,visualType:e.target.value})}/></label>
            <label>비율<input value={draft.imagePlan.ratio} onChange={e=>patch('imagePlan',{...draft.imagePlan,ratio:e.target.value})}/></label>
            <label className="span2">주요 피사체<input value={draft.imagePlan.subject} onChange={e=>patch('imagePlan',{...draft.imagePlan,subject:e.target.value})} placeholder="인물, 자동차, 제품 등"/></label>
            <label className="span2">배경/분위기<input value={draft.imagePlan.background} onChange={e=>patch('imagePlan',{...draft.imagePlan,background:e.target.value})}/></label>
            <label>메인 문구<input value={draft.imagePlan.mainText} onChange={e=>patch('imagePlan',{...draft.imagePlan,mainText:e.target.value})}/></label>
            <label>서브 문구<input value={draft.imagePlan.subText} onChange={e=>patch('imagePlan',{...draft.imagePlan,subText:e.target.value})}/></label>
            <label>텍스트 비율<input value={draft.imagePlan.textRatio} onChange={e=>patch('imagePlan',{...draft.imagePlan,textRatio:e.target.value})}/></label>
          </div> : <div className="ad26-form-grid">
            <label>영상 길이<input value={draft.videoPlan.length} onChange={e=>patch('videoPlan',{...draft.videoPlan,length:e.target.value})}/></label>
            <label>스타일<input value={draft.videoPlan.style} onChange={e=>patch('videoPlan',{...draft.videoPlan,style:e.target.value})}/></label>
            <label className="span2">첫 3초 후킹<input value={draft.videoPlan.hook3s} onChange={e=>patch('videoPlan',{...draft.videoPlan,hook3s:e.target.value})}/></label>
            <label className="span2">씬 구성<textarea rows={6} value={draft.videoPlan.scenes} onChange={e=>patch('videoPlan',{...draft.videoPlan,scenes:e.target.value})} placeholder={'0~3초: 후킹\n3~10초: 문제/공감\n10~20초: 혜택\n마지막: CTA'}/></label>
            <label className="span2">엔딩 CTA<input value={draft.videoPlan.endingCta} onChange={e=>patch('videoPlan',{...draft.videoPlan,endingCta:e.target.value})}/></label>
          </div>}
        </section>

        <section className="card ad26-summary">
          <div><FileText size={20}/><span>저장 방식</span><b>PostgreSQL</b></div>
          <div><Archive size={20}/><span>제작물 보관함 연동</span><b>PHASE 2 후속</b></div>
          <div><ImageIcon size={20}/><span>이미지/영상 파일 저장</span><b>자산 기능 이전 후 연결</b></div>
        </section>
      </main>
    </div>
  </div>;
}
