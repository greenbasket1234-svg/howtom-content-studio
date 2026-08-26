import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import { AdvertiserProvider } from './context/AdvertiserContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { StubPage } from './pages/stub/StubPage';
import { BlogProductionPage } from './features/blog/BlogProductionPage';
import { AdCreationPage } from './features/ad/AdCreationPage';
import { TemplatesPage } from './features/templates/TemplatesPage';
import { DocumentWritingPage } from './features/document/DocumentWritingPage';
import { VideoScriptPage } from './features/videoscript/VideoScriptPage';
import { ProductionLibraryPage } from './features/library/ProductionLibraryPage';
import { ContentCalendarPage } from './features/calendar/ContentCalendarPage';
import { AssetsPage } from './features/assets/AssetsPage';
import { ReferenceExplorePage } from './features/references/ReferenceExplorePage';

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

      {/* PHASE 2B: 블로그 + 광고 제작만 실제 기능으로 이전. 나머지는 승인 전까지 Stub 유지. */}
      <Route path="/references" element={<RequireAuth><ReferenceExplorePage /></RequireAuth>} />
      <Route path="/references/competitors" element={<Stub title="경쟁사 모니터링" phase="PHASE 3" />} />
      <Route path="/references/boards" element={<Stub title="레퍼런스 보드" phase="PHASE 3" />} />
      <Route path="/references/settings" element={<Stub title="수집 설정" phase="PHASE 3" />} />

      <Route path="/production/ad" element={<RequireAuth><AdCreationPage /></RequireAuth>} />
      <Route path="/production/blog" element={<RequireAuth><BlogProductionPage /></RequireAuth>} />
      <Route path="/production/image" element={<Stub title="이미지 제작" phase="PHASE 2" />} />
      <Route path="/production/video-script" element={<RequireAuth><VideoScriptPage /></RequireAuth>} />
      <Route path="/production/document" element={<RequireAuth><DocumentWritingPage /></RequireAuth>} />

      <Route path="/library" element={<RequireAuth><ProductionLibraryPage /></RequireAuth>} />
      <Route path="/calendar" element={<RequireAuth><ContentCalendarPage /></RequireAuth>} />
      <Route path="/templates" element={<RequireAuth><TemplatesPage /></RequireAuth>} />

      <Route path="/assets/images" element={<RequireAuth><AssetsPage assetType="image" /></RequireAuth>} />
      <Route path="/assets/videos" element={<RequireAuth><AssetsPage assetType="video" /></RequireAuth>} />
      <Route path="/assets/documents" element={<RequireAuth><AssetsPage assetType="document" /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
