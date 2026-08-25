import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import { AdvertiserProvider } from './context/AdvertiserContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { StubPage } from './pages/stub/StubPage';
import { TemplatesPage } from './pages/production/TemplatesPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AdvertiserProvider>
      <Layout>{children}</Layout>
    </AdvertiserProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />

      {/* 레퍼런스 - PHASE 3에서 Meta 레퍼런스 MVP로 구현 예정 */}
      <Route path="/references" element={<RequireAuth><StubPage title="레퍼런스 탐색" phase="PHASE 3" /></RequireAuth>} />
      <Route path="/references/competitors" element={<RequireAuth><StubPage title="경쟁사 모니터링" phase="PHASE 3" /></RequireAuth>} />
      <Route path="/references/boards" element={<RequireAuth><StubPage title="레퍼런스 보드" phase="PHASE 3" /></RequireAuth>} />
      <Route path="/references/settings" element={<RequireAuth><StubPage title="수집 설정" phase="PHASE 3" /></RequireAuth>} />

      {/* 제작 - PHASE 2에서 Universe의 기존 기능 이전 예정 */}
      <Route path="/production/ad" element={<RequireAuth><StubPage title="광고 제작" phase="PHASE 2" /></RequireAuth>} />
      <Route path="/production/blog" element={<RequireAuth><StubPage title="블로그 제작" phase="PHASE 2" /></RequireAuth>} />
      <Route path="/production/image" element={<RequireAuth><StubPage title="이미지 제작" phase="PHASE 2" /></RequireAuth>} />
      <Route path="/production/video-script" element={<RequireAuth><StubPage title="영상 대본" phase="PHASE 2" /></RequireAuth>} />
      <Route path="/production/document" element={<RequireAuth><StubPage title="문서 작성" phase="PHASE 2" /></RequireAuth>} />

      {/* 콘텐츠 관리 - PHASE 2에서 이전 예정 */}
      <Route path="/library" element={<RequireAuth><StubPage title="제작물 보관함" phase="PHASE 2" /></RequireAuth>} />
      <Route path="/calendar" element={<RequireAuth><StubPage title="콘텐츠 캘린더" phase="PHASE 2" /></RequireAuth>} />
      <Route path="/templates" element={<RequireAuth><TemplatesPage /></RequireAuth>} />

      {/* 자산 - PHASE 2 이후 */}
      <Route path="/assets/images" element={<RequireAuth><StubPage title="이미지 자산" phase="PHASE 2" /></RequireAuth>} />
      <Route path="/assets/videos" element={<RequireAuth><StubPage title="영상 자산" phase="PHASE 2" /></RequireAuth>} />
      <Route path="/assets/documents" element={<RequireAuth><StubPage title="문서 자산" phase="PHASE 2" /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
