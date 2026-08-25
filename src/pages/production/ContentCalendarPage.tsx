import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertiserContext } from '../../context/AdvertiserContext';
import { loadProjects } from '../../store/contentStore';
import { blogApi } from '../../features/blog/blogApi';

type CalendarItem = { id: string; kind: '광고' | '블로그' | '영상 대본' | '문서'; title: string; advertiserId: string; advertiserName: string; date: string; openRoute: string };
const KIND_COLOR: Record<CalendarItem['kind'], string> = { 광고: '#2563eb', 블로그: '#16a34a', '영상 대본': '#f59e0b', 문서: '#8b5cf6' };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function ContentCalendarPage() {
  const navigate = useNavigate();
  const { selectedId } = useAdvertiserContext();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const local = loadProjects().map(p => ({
        id: p.projectId, kind: (p.projectType === 'video-script' ? '영상 대본' : p.projectType === 'document' ? '문서' : '광고') as CalendarItem['kind'],
        title: p.title, advertiserId: p.advertiserId, advertiserName: p.advertiserName, date: p.updatedAt,
        openRoute: p.projectType === 'video-script' ? `/production/video-script?project=${p.projectId}` : p.projectType === 'document' ? `/production/document?project=${p.projectId}` : `/production/ad?project=${p.projectId}`,
      }));
      let blog: CalendarItem[] = [];
      try {
        const rows = await blogApi.projects();
        blog = rows.map(p => ({ id: p.projectId, kind: '블로그' as const, title: p.selectedTitle || p.primaryKeyword || '제목 미정', advertiserId: p.advertiserId, advertiserName: p.advertiserName, date: p.updatedAt, openRoute: `/production/blog?project=${p.projectId}` }));
      } catch { /* 블로그 조회 실패해도 나머지는 보여줍니다. */ }
      setItems([...local, ...blog]);
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(() => items.filter(i => !selectedId || i.advertiserId === selectedId), [items, selectedId]);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = useMemo(() => {
    const map = new Map<number, CalendarItem[]>();
    for (const item of visible) {
      const d = new Date(item.date);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      map.set(day, [...(map.get(day) || []), item]);
    }
    return map;
  }, [visible, year, month]);
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="content-system-page">
      <PageHeader title="콘텐츠 캘린더" description="광고·블로그·영상 대본·문서 제작 일정을 한눈에 확인합니다." />
      <section className="cs-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button className="cs-btn" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={15} /></button>
          <b style={{ fontSize: 15 }}>{year}년 {month + 1}월</b>
          <button className="cs-btn" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={15} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {WEEKDAYS.map(w => <div key={w} style={{ background: '#f8fafc', textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{w}</div>)}
          {cells.map((day, i) => (
            <div key={i} style={{ background: '#fff', minHeight: 90, padding: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {day !== null && (
                <>
                  <strong style={{ fontSize: 12, color: isToday(day) ? 'var(--accent)' : 'var(--text-primary)' }}>{day}</strong>
                  {(byDay.get(day) || []).slice(0, 3).map(item => (
                    <button key={`${item.kind}-${item.id}`} onClick={() => navigate(item.openRoute)} title={item.title}
                      style={{ textAlign: 'left', border: 0, borderRadius: 5, padding: '2px 5px', fontSize: 10.5, cursor: 'pointer', background: `${KIND_COLOR[item.kind]}18`, color: KIND_COLOR[item.kind], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.advertiserName} · {item.title}
                    </button>
                  ))}
                  {(byDay.get(day)?.length || 0) > 3 && <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{(byDay.get(day)?.length || 0) - 3}개 더보기</small>}
                </>
              )}
            </div>
          ))}
        </div>
        {loading && <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)' }}>불러오는 중...</p>}
      </section>
      <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>
        {(Object.keys(KIND_COLOR) as CalendarItem['kind'][]).map(k => <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: KIND_COLOR[k] }} />{k}</span>)}
      </div>
    </div>
  );
}
