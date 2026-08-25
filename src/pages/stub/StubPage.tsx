/**
 * 아직 이전하지 않은 메뉴는 라우팅만 유지합니다.
 * 가짜 데이터나 임시 기능으로 완료한 것처럼 보이게 하지 않습니다.
 */
export function StubPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>{title}</h1>
      <div className="cs-card cs-stub-card">
        <b>{phase}에서 구현될 예정입니다</b>
        블로그·광고 제작 외 기능은 아직 활성화하지 않았습니다. 승인 후 기능 단위로 하나씩 이전합니다.
      </div>
    </div>
  );
}
