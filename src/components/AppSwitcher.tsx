import { useState } from 'react';

// 두 앱은 서로 다른 도메인/서비스로 배포되므로, 환경변수로 서로의 주소를 알려줍니다.
// Vite는 빌드 시점에 VITE_ 접두사가 붙은 값만 클라이언트 코드에 심어줍니다.
const UNIVERSE_URL = import.meta.env.VITE_UNIVERSE_URL || 'https://universe.howtom.example.com';

/** 상단에 "HOWTOM ▼" 형태로 표시되는, 유니버스/콘텐츠 제작소 전환 메뉴입니다. */
export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  return (
    <div className="cs-app-switcher">
      <button className="cs-btn" onClick={() => setOpen(v => !v)}>HOWTOM ▾</button>
      {open && (
        <div className="cs-app-switcher-menu" onMouseLeave={() => setOpen(false)}>
          <a className="cs-app-switcher-item" href={UNIVERSE_URL}>○ 유니버스</a>
          <button className="cs-app-switcher-item active" disabled>● 콘텐츠 제작소</button>
        </div>
      )}
    </div>
  );
}
