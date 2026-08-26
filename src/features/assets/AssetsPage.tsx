import { useEffect, useState, type FormEvent } from 'react';
import { FileText, Image as ImageIcon, Plus, Search, Trash2, Video } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { assetsApi, type AssetType, type ContentAsset } from './assetsApi';

const CONFIG: Record<AssetType, { title: string; icon: typeof ImageIcon }> = {
  image: { title: '이미지', icon: ImageIcon },
  video: { title: '영상', icon: Video },
  document: { title: '문서', icon: FileText },
};

export function AssetsPage({ assetType }: { assetType: AssetType }) {
  const { advertisers, selectedId } = useAdvertiserContext();
  const config = CONFIG[assetType];
  const [rows, setRows] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => { setLoading(true); assetsApi.list(assetType).then(setRows).catch(e => setNotice(e instanceof Error ? e.message : '자산을 불러오지 못했습니다.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [assetType]);

  const visible = rows.filter(a => (!query || `${a.name} ${a.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())) && (!selectedId || !a.advertiserId || a.advertiserId === selectedId));

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') || '').trim();
    if (!name) return;
    try {
      await assetsApi.create({ assetType, name, url: String(f.get('url') || '').trim() || undefined, advertiserId: String(f.get('advertiserId') || '') || undefined, tags: String(f.get('tags') || '').split(',').map(x => x.trim()).filter(Boolean), memo: String(f.get('memo') || '') || undefined });
      setOpen(false); load();
    } catch (e) { setNotice(e instanceof Error ? e.message : '등록하지 못했습니다.'); }
  };
  const remove = async (id: string) => {
    if (!confirm('이 자산을 삭제할까요?')) return;
    try { await assetsApi.remove(id); load(); } catch (e) { setNotice(e instanceof Error ? e.message : '삭제하지 못했습니다.'); }
  };

  return (
    <div className="content-system-page">
      <PageHeader title={`${config.title} 자산`} description={`광고주별 ${config.title} 자산의 URL과 태그를 등록해두고 제작 시 참고합니다.`} action={<button className="cs-btn cs-btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> 자산 등록</button>} />
      {notice && <div className="content-notice">{notice}</div>}
      <section className="cs-card content-toolbar"><div className="content-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="이름·태그 검색" /></div></section>

      {loading ? <div className="content-empty">불러오는 중...</div> : (
        <section className="content-template-grid">
          {visible.map(a => (
            <article key={a.id} className="cs-card content-template-card">
              {assetType === 'image' && a.url ? (
                <img src={a.url} alt={a.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 10, background: '#f1f5f9' }} />
              ) : (
                <div className="content-template-icon"><config.icon size={21} /></div>
              )}
              <h3 style={{ fontSize: 14.5, margin: 0 }}>{a.name}</h3>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>{a.advertiserName || '공통'}</p>
              {a.tags.length > 0 && <div className="content-template-blocks">{a.tags.map(t => <small key={t}>{t}</small>)}</div>}
              <div className="content-card-actions">
                {a.url && <a className="cs-btn" style={{ textDecoration: 'none', flex: 1, textAlign: 'center' }} href={a.url} target="_blank" rel="noreferrer">원본 열기</a>}
                <button className="danger" onClick={() => remove(a.id)}><Trash2 size={13} /></button>
              </div>
            </article>
          ))}
          {!visible.length && <div className="content-empty">등록된 {config.title} 자산이 없습니다.</div>}
        </section>
      )}

      {open && (
        <div className="content-modal-backdrop" onClick={() => setOpen(false)}>
          <form className="content-modal" onSubmit={save} onClick={e => e.stopPropagation()}>
            <div className="content-modal-head"><div><h3>{config.title} 자산 등록</h3><p>URL을 등록해두면 제작 시 참고할 수 있습니다.</p></div></div>
            <div className="content-form-grid">
              <label className="span2">이름<input name="name" required /></label>
              <label className="span2">{config.title} URL<input name="url" type="url" placeholder="https://..." /></label>
              <label>광고주<select name="advertiserId"><option value="">공통</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label>태그<input name="tags" placeholder="쉼표로 구분" /></label>
              <label className="span2">메모<textarea name="memo" rows={2} /></label>
            </div>
            <div className="content-modal-actions"><button type="button" className="cs-btn" onClick={() => setOpen(false)}>취소</button><button className="cs-btn cs-btn-primary" type="submit">저장</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
