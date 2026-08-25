# HOWTOM 콘텐츠 제작소 (HOWTOM Content Studio)

HOWTOM 유니버스에서 콘텐츠 관련 기능만 분리한 별도 웹앱입니다.
**PHASE 1 (이 구조만 검증하는 단계)** — 레퍼런스·제작 기능은 아직 없습니다.

---

## 1. 유니버스(Universe)와 콘텐츠 제작소(Content Studio)의 역할

| | HOWTOM 유니버스 | HOWTOM 콘텐츠 제작소 |
|---|---|---|
| 역할 | 광고 운영·성과 데이터·인사이트·보고서 | 레퍼런스·광고 제작·블로그·영상 대본 등 콘텐츠 |
| 코드 위치 | `howtomuniverse-main/` (기존 그대로) | `howtom-content-studio/` (이 폴더, 신규) |
| 배포 | Railway 서비스 1 (기존) | Railway 서비스 2 (신규 추가) |

**두 앱은 완전히 독립된 프로세스입니다.** 서로의 API를 호출하지 않습니다.

## 2. 어떤 DB를 공유하는지

두 앱은 **같은 PostgreSQL 데이터베이스**를 씁니다 (같은 `DATABASE_URL`).
단, 콘텐츠 제작소는 PHASE 1에서 `tenants`, `advertisers` 테이블을 **읽기만** 합니다.
새 테이블을 만들지 않았습니다 (레퍼런스 기능이 생기는 PHASE 3부터 `references` 등 전용 테이블이 추가될 예정).

## 3. advertiser_id 연결 방식

콘텐츠 제작소 상단의 광고주 선택 드롭다운(`src/context/AdvertiserContext.tsx`)은
유니버스와 **완전히 같은 `advertisers` 테이블의 `id`**를 그대로 씁니다.
예: 유니버스에서 "RS컴퍼니"의 id가 `37`이면, 콘텐츠 제작소에서도 똑같이 `37`입니다.
새로운 광고주 개념이나 별도 매핑 테이블은 없습니다.

## 4. 실행 방법 (로컬 개발)

```bash
cd howtom-content-studio
npm install
# 터미널 1: API 서버 (기본 포트 4100)
PORT=4100 DATABASE_URL=... JWT_SECRET=... HOWTOM_ADMIN_EMAIL=... HOWTOM_ADMIN_PASSWORD=... node server.mjs
# 터미널 2: 프론트엔드 개발 서버 (포트 5174, /api는 자동으로 4100번으로 프록시됨)
npm run dev
```

## 5. 배포 방법 (Railway)

같은 Railway 프로젝트 안에 **새 서비스**로 추가합니다.

1. Railway 대시보드 → 기존 프로젝트 → "New Service" → 이 저장소(`howtom-content-studio` 폴더) 연결
2. 환경변수 설정 (아래 6번 목록 참고) — **`DATABASE_URL`, `JWT_SECRET`, `HOWTOM_ADMIN_EMAIL`, `HOWTOM_ADMIN_PASSWORD`는 유니버스 서비스와 정확히 같은 값**을 넣습니다
3. 빌드 명령: `npm run build` (자동 감지), 시작 명령: `node server.mjs` (`railway.toml`에 이미 지정됨)

## 6. 환경변수 목록

| 변수 | 설명 | 유니버스와 같은 값? |
|---|---|---|
| `DATABASE_URL` | Postgres 연결 문자열 | ✅ 반드시 같아야 함 |
| `JWT_SECRET` | 로그인 토큰 서명 키 | ✅ 반드시 같아야 함 |
| `HOWTOM_ADMIN_EMAIL` | 관리자 이메일 | ✅ 반드시 같아야 함 |
| `HOWTOM_ADMIN_PASSWORD` | 관리자 비밀번호 | ✅ 반드시 같아야 함 |
| `HOWTOM_ADMIN_NAME` | 화면에 표시될 이름 | 같아도, 달라도 무방 |
| `PORT` | 서버 포트 (Railway가 자동 주입) | 무관 |
| `VITE_UNIVERSE_URL` | "HOWTOM ▾" 메뉴에서 유니버스로 돌아갈 주소 (빌드 시점에 필요) | 유니버스의 실제 배포 URL 입력 |

## 7. Reference 관련 테이블 (PHASE 3부터 추가 예정)

PHASE 1에는 콘텐츠 전용 테이블이 없습니다. PHASE 3(Meta 레퍼런스)부터 아래 형태의
테이블이 **기존 Postgres에** 추가될 예정입니다 (별도 DB 아님):

- `references` — 저장한 광고 레퍼런스
- `reference_competitors` — 광고주별 등록한 경쟁 브랜드
- `reference_boards`, `reference_board_items` — 레퍼런스 보드
- `reference_collection_rules` — 수집 조건 저장

## 8. 콘텐츠 제작소 주요 라우트

| 경로 | 화면 | 상태 |
|---|---|---|
| `/` | 홈 | 구현됨 |
| `/references` 이하 4개 | 레퍼런스 | PHASE 3 예정 (현재 안내 화면만) |
| `/production/*` 5개 | 제작 | PHASE 2 예정 (현재 안내 화면만) |
| `/library`, `/calendar`, `/templates` | 콘텐츠 관리 | PHASE 2 예정 |
| `/assets/*` 3개 | 자산 | PHASE 2 예정 |

라우트 정의는 `src/App.tsx` 한 파일에 전부 있습니다.

## 9. 플랫폼 Connector 추가 방법 (PHASE 3 이후)

Meta/YouTube 등 레퍼런스 수집 커넥터를 추가할 때는, HOWTOM 유니버스의
`lib/referenceConnectors.mjs` 패턴(하나의 함수 = 하나의 플랫폼, `search()` 메서드로
표준화된 결과를 반환)을 그대로 이 프로젝트의 `lib/` 폴더에 재사용하는 것을 권장합니다.
API 코드를 화면(React 컴포넌트) 안에 직접 작성하지 않습니다.

## 10. Reference Worker 추가 방법 (PHASE 4 이후)

자동 수집이 필요해지면, 이 웹 서버(`server.mjs`)에 넣지 말고 **완전히 별도의
Node 프로세스/Railway 서비스**로 분리하는 것을 권장합니다. 그래야 수집 작업이
느려지거나 실패해도 콘텐츠 제작소·유니버스 화면 응답 속도에 영향을 주지 않습니다.

## 11. AI Gateway를 나중에 추가할 위치

PHASE 7에서 AI 분석/생성 기능을 붙일 때는, `server.mjs`에 `/api/ai/*` 형태의
엔드포인트를 추가하고, 실제 AI 호출 로직은 별도 `lib/aiGateway.mjs` 파일로
분리하는 것을 권장합니다 (Connector와 동일한 원칙 — API 로직과 화면을 분리).

## 12. 이 앱을 수정할 때 (AI에게 요청하는 방법 예시)

- "콘텐츠 제작소의 홈 화면 레이아웃만 수정해줘" — `src/pages/HomePage.tsx`만 관련
- "콘텐츠 제작소 사이드바 메뉴 순서를 바꿔줘" — `src/components/Layout.tsx`의 `NAV_GROUPS`만 관련
- "콘텐츠 제작소 로그인 화면 디자인만 바꿔줘" — `src/pages/LoginPage.tsx` + `src/design/tokens.css`만 관련

**이 프로젝트를 수정할 때는 항상 "콘텐츠 제작소의 ○○만 수정해"처럼 범위를 명확히
지정하면, HOWTOM 유니버스 코드는 전혀 건드리지 않고 작업할 수 있습니다.**
