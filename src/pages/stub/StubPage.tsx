/**
 * PHASE 1에서는 레퍼런스/제작/콘텐츠관리/자산 메뉴가 라우팅만 존재하고,
 * 실제 기능은 아직 없습니다(PHASE 2~3에서 기존 Universe 기능을 이전하거나
 * 새로 구현합니다). 여기서 가짜 데이터로 동작하는 척 만들지 않고,
 * 정직하게 "아직 없다"는 안내만 보여줍니다.
 */
export function StubPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>{title}</h1>
      <div className="cs-card cs-stub-card">
        <b>{phase}에서 구현될 예정입니다</b>
        지금은 HOWTOM 유니버스와의 광고주 공유·화면 이동 구조(PHASE 1)만 검증하는 단계입니다.
      </div>
    </div>
  );
}
