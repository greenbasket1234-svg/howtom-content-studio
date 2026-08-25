import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, FileText, Image as ImageIcon, Search, Trash2, Video } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { cloneProject, deleteProject, loadProjects } from '../../store/contentStore';
import { blogApi } from '../../features/blog/blogApi';

/** contentStore(광고/영상대본/문서)와 blogApi(블로그) 두 데이터 소스를 하나의 화면용 형태로 합칩니다. */
type LibraryItem = {
  id: string; kind: '광고' | '블로그' | '영상 대본' | '문서'; title: string; advertiserId: string; advertiserName: string; status: string; updatedAt: string;
  openRoute: string; onDelete: () => Promise<void> | void;
};
const STATUS_LABEL: Record<string, string> = { draft: '초안', writing: '작성 중', 'in-progress': '제작 중', review: '검토 요청', revision: '수정 필요', approved: '승인', completed: '제작 완료', 'publish-ready': '발행 대기', published: '발행 완료', live: '광고 사용', archived: '보관' };
const fmt = (v?: string) => { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };

export function ProductionLibraryPage() {
  const navigate = useNavigate();
  const { selectedId } = useAdvertiserContext();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'전체' | LibraryItem['kind']>('전체');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    const localProjects = loadProjects(); // 광고/영상대본/문서 (localStorage)
    let blogProjects: Awaited<ReturnType<typeof blogApi.projects>> = [];
    try { blogProjects = await blogApi.projects(); } catch { /* 블로그 서버 조회 실패 시에도 나머지는 보여줍니다. */ }

    const local: LibraryItem[] = localProjects.map(p => ({
      id: p.projectId,
      kind: p.projectType === 'video-script' ? '영상 대본' : p.projectType === 'document' ? '문서' : '광고',
      title: p.title, advertiserId: p.advertiserId, advertiserName: p.advertiserName, status: p.status, updatedAt: p.updatedAt,
      openRoute: p.projectType === 'video-script' ? `/production/video-script?project=${p.projectId}` : p.projectType === 'document' ? `/production/document?project=${p.projectId}` : `/production/ad?project=${p.projectId}`,
      onDelete: () => deleteProject(p.projectId),
    }));
    const blog: LibraryItem[] = blogProjects.map(p => ({
      id: p.projectId, kind: '블로그', title: p.selectedTitle || p.primaryKeyword || '제목 미정', advertiserId: p.advertiserId, advertiserName: p.advertiserName, status: p.status, updatedAt: p.updatedAt,
      openRoute: `/production/blog?project=${p.projectId}`,
      onDelete: () => blogApi.deleteProject(p.projectId),
    }));
    setItems([...local, ...blog].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => items.filter(i => (kind === '전체' || i.kind === kind) && (!query || `${i.title} ${i.advertiserName}`.toLowerCase().includes(query.toLowerCase())) && (!selectedId || i.advertiserId === selectedId)), [items, kind, query, selectedId]);

  const duplicate = (id: string) => { const cloned = cloneProject(id); void load(); if (cloned) navigate(`/production/ad?project=${cloned.projectId}`); };
  const remove = async (item: LibraryItem) => {
    if (!confirm(`"${item.title}" 항목을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try { await item.onDelete(); setNotice('삭제했습니다.'); void load(); } catch (e) { setNotice(e instanceof Error ? e.message : '삭제하지 못했습니다.'); }
  };

  const iconOf = (kind: LibraryItem['kind']) => kind === '영상 대본' ? <Video size={18} /> : kind === '광고' ? <ImageIcon size={18} /> : <FileText size={18} />;

  return (
    <div className="content-system-page">
      <PageHeader title="제작물 보관함" description="광고·블로그·영상 대본·문서 결과물을 한곳에서 확인합니다." />
      {notice && <div className="content-notice">{notice}</div>}
      <section className="cs-card content-toolbar">
        <div className="content-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목·광고주 검색" /></div>
      </section>
      <div className="content-quick-tabs">
        {(['전체', '광고', '블로그', '영상 대본', '문서'] as const).map(k => <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k} <b>{k === '전체' ? items.length : items.filter(i => i.kind === k).length}</b></button>)}
      </div>
      {loading ? (
        <div className="content-empty">불러오는 중...</div>
      ) : (
        <section className="content-project-grid">
          {visible.map(item => (
            <article key={`${item.kind}-${item.id}`} className="cs-card content-project-card">
              <div className="content-project-icon">{iconOf(item.kind)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="content-status neutral">{item.kind}</span><small style={{ color: 'var(--text-muted)' }}>{fmt(item.updatedAt)}</small></div>
              <h3 style={{ margin: '6px 0 0', fontSize: 14.5 }}>{item.title}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{item.advertiserName} · {STATUS_LABEL[item.status] || item.status}</p>
              <div className="content-project-actions">
                <button onClick={() => navigate(item.openRoute)}>열기</button>
                {item.kind === '광고' && <button onClick={() => duplicate(item.id)}><Copy size={13} /> 복제</button>}
                <button className="danger" onClick={() => remove(item)}><Trash2 size={13} /></button>
              </div>
            </article>
          ))}
          {!visible.length && <div className="content-empty">아직 저장된 제작물이 없습니다.</div>}
        </section>
      )}
    </div>
  );
}
