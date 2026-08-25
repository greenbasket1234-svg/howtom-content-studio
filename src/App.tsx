import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import { AdvertiserProvider } from './context/AdvertiserContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { StubPage } from './pages/stub/StubPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AdvertiserProvider>
      <Layout>{children}</Layout>
    </AdvertiserProvider>
  );
}

function Stub({ title, phase }: { title: string; phase: string }) {
  return <RequireAuth><StubPage title={title} phase={phase} /></RequireAuth>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />

      {/* PHASE 1: 메뉴/라우팅 골격만 제공. 실제 기능은 승인 후 단계별 이전/구현합니다. */}
      <Route path="/references" element={<Stub title="레퍼런스 탐색" phase="PHASE 3" />} />
      <Route path="/references/competitors" element={<Stub title="경쟁사 모니터링" phase="PHASE 3" />} />
      <Route path="/references/boards" element={<Stub title="레퍼런스 보드" phase="PHASE 3" />} />
      <Route path="/references/settings" element={<Stub title="수집 설정" phase="PHASE 3" />} />

      <Route path="/production/ad" element={<Stub title="광고 제작" phase="PHASE 2" />} />
      <Route path="/production/blog" element={<Stub title="블로그 제작" phase="PHASE 2" />} />
      <Route path="/production/image" element={<Stub title="이미지 제작" phase="PHASE 2" />} />
      <Route path="/production/video-script" element={<Stub title="영상 대본" phase="PHASE 2" />} />
      <Route path="/production/document" element={<Stub title="문서 작성" phase="PHASE 2" />} />

      <Route path="/library" element={<Stub title="제작물 보관함" phase="PHASE 2" />} />
      <Route path="/calendar" element={<Stub title="콘텐츠 캘린더" phase="PHASE 2" />} />
      <Route path="/templates" element={<Stub title="템플릿" phase="PHASE 2" />} />

      <Route path="/assets/images" element={<Stub title="이미지 자산" phase="PHASE 2" />} />
      <Route path="/assets/videos" element={<Stub title="영상 자산" phase="PHASE 2" />} />
      <Route path="/assets/documents" element={<Stub title="문서 자산" phase="PHASE 2" />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
