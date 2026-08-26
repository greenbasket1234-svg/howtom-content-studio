import { useEffect, useState, type FormEvent } from 'react';
import { Layers3, Plus, Save, Search, Star, Trash2, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { templatesApi } from './templatesApi';
import type { ContentTemplate, TemplateBlock, TemplateType } from './templateTypes';

const TYPE_LABEL: Record<TemplateType, string> = { 'ad-copy': '광고 카피', 'image-brief': '이미지', 'video-script': '영상', blog: '블로그', document: '문서' };

export function TemplatesPage() {
  const { advertisers } = useAdvertiserContext();
  const [rows, setRows] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | TemplateType>('all');
  const [scope, setScope] = useState<'all' | 'common' | 'advertiser'>('all');
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => { setLoading(true); templatesApi.list().then(setRows).catch(e => setNotice(e instanceof Error ? e.message : '템플릿을 불러오지 못했습니다.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const visible = rows.filter(t =>
    (!query || [t.name, t.description, t.channel, ...t.tags].join(' ').toLowerCase().includes(query.toLowerCase())) &&
    (type === 'all' || t.templateType === type) &&
    (scope === 'all' || (scope === 'common' && !t.advertiserId) || (scope === 'advertiser' && !!t.advertiserId))
  );

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const advertiserId = String(f.get('advertiserId') || '') || null;
    const lines = String(f.get('blocks') || '').split('\n').map(x => x.trim()).filter(Boolean);
    const blocks: TemplateBlock[] = lines.map((label, i) => ({ blockId: `block-${i + 1}`, label, blockType: 'textarea' }));
    const maxHeadline = Number(f.get('headlineMax') || 0);
    const maxDescription = Number(f.get('descriptionMax') || 0);
    try {
      await templatesApi.create({
        name: String(f.get('name') || '새 템플릿'), templateType: String(f.get('templateType') || 'ad-copy') as TemplateType,
        advertiserId, channel: String(f.get('channel') || '') || undefined, description: String(f.get('description') || '') || undefined, blocks,
        rules: [...(maxHeadline ? [{ field: 'headline', type: 'maxLength' as const, value: maxHeadline }] : []), ...(maxDescription ? [{ field: 'description', type: 'maxLength' as const, value: maxDescription }] : [])],
        tags: String(f.get('tags') || '').split(',').map(x => x.trim()).filter(Boolean),
      });
      setOpen(false); load();
    } catch (e) { setNotice(e instanceof Error ? e.message : '저장하지 못했습니다.'); }
  };
  const toggleFavorite = async (t: ContentTemplate) => { try { await templatesApi.patch(t.templateId, { isFavorite: !t.isFavorite }); load(); } catch (e) { setNotice(e instanceof Error ? e.message : '변경하지 못했습니다.'); } };
  const duplicate = async (id: string) => { try { await templatesApi.duplicate(id); load(); } catch (e) { setNotice(e instanceof Error ? e.message : '복제하지 못했습니다.'); } };
  const newVersion = async (id: string) => { try { await templatesApi.newVersion(id); load(); } catch (e) { setNotice(e instanceof Error ? e.message : '새 버전을 만들지 못했습니다.'); } };
  const remove = async (t: ContentTemplate) => {
    if (!confirm(`"${t.name}" 템플릿을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try { await templatesApi.remove(t.templateId); load(); } catch (e) { setNotice(e instanceof Error ? e.message : '삭제하지 못했습니다.'); }
  };

  return (
    <div className="content-system-page">
      <PageHeader title="템플릿" description="광고·이미지·영상·블로그·문서 제작 구조와 글자수 규칙을 표준화합니다." action={<button className="cs-btn cs-btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> 새 템플릿</button>} />
      {notice && <div className="content-notice">{notice}</div>}

      <section className="cs-card content-toolbar">
        <div className="content-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="템플릿 이름·태그 검색" /></div>
        <select value={type} onChange={e => setType(e.target.value as typeof type)}><option value="all">전체 유형</option>{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={scope} onChange={e => setScope(e.target.value as typeof scope)}><option value="all">전체 범위</option><option value="common">회사 공용</option><option value="advertiser">광고주 전용</option></select>
      </section>

      <div className="content-quick-tabs">
        <button className={type === 'all' ? 'active' : ''} onClick={() => setType('all')}>전체 <b>{rows.length}</b></button>
        {(Object.keys(TYPE_LABEL) as TemplateType[]).map(t => <button key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>{TYPE_LABEL[t]} <b>{rows.filter(r => r.templateType === t).length}</b></button>)}
      </div>

      {loading ? <div className="content-empty">불러오는 중...</div> : (
        <section className="content-template-grid">
          {visible.map(t => (
            <article key={t.templateId} className="cs-card content-template-card">
              <div className="content-template-top">
                <div className="content-template-icon"><Layers3 size={21} /></div>
                <button onClick={() => toggleFavorite(t)}><Star size={17} fill={t.isFavorite ? 'currentColor' : 'none'} /></button>
              </div>
              <span>{TYPE_LABEL[t.templateType]}{t.channel ? ` · ${t.channel}` : ''}</span>
              <h3>{t.name}</h3>
              <p>{t.description || '제작 구조 템플릿'}</p>
              <div className="content-template-blocks">{t.blocks.slice(0, 5).map(b => <small key={b.blockId}>{b.label}</small>)}</div>
              {t.rules.length > 0 && <div className="content-rule-row">{t.rules.map((r, i) => <span key={i}>{r.field === 'headline' ? '제목' : r.field === 'description' ? '설명' : r.field} {r.type === 'maxLength' ? `${r.value}자 이하` : String(r.value)}</span>)}</div>}
              <div className="content-template-meta"><span>{t.advertiserName || '회사 공용'}</span><span>v{t.version}</span><span>사용 {t.useCount}회</span></div>
              <div className="content-card-actions">
                <button onClick={() => duplicate(t.templateId)}>복제</button>
                <button onClick={() => newVersion(t.templateId)}>새 버전</button>
                <button className="danger" onClick={() => remove(t)}><Trash2 size={13} /> 삭제</button>
              </div>
            </article>
          ))}
          {!visible.length && <div className="content-empty">조건에 맞는 템플릿이 없습니다.</div>}
        </section>
      )}

      {open && (
        <div className="content-modal-backdrop" onClick={() => setOpen(false)}>
          <form className="content-modal" onSubmit={save} onClick={e => e.stopPropagation()}>
            <div className="content-modal-head"><div><h3>새 템플릿</h3><p>반복할 제작 구조와 규칙을 정의합니다.</p></div><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
            <div className="content-form-grid">
              <label>이름<input name="name" required /></label>
              <label>유형<select name="templateType">{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label>광고주<select name="advertiserId"><option value="">회사 공용</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label>매체<input name="channel" placeholder="메타, 네이버 GFA 등" /></label>
              <label className="span2">설명<input name="description" /></label>
              <label className="span2">구성 블록<textarea name="blocks" rows={7} placeholder={'후킹\n문제/공감\n핵심 혜택\n근거\nCTA'} required /></label>
              <label>제목 최대 글자수<input name="headlineMax" type="number" min="0" /></label>
              <label>설명 최대 글자수<input name="descriptionMax" type="number" min="0" /></label>
              <label className="span2">태그<input name="tags" placeholder="메타, DB, 후기형" /></label>
            </div>
            <div className="content-modal-actions"><button type="button" className="cs-btn" onClick={() => setOpen(false)}>취소</button><button className="cs-btn cs-btn-primary" type="submit"><Save size={15} /> 저장</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
