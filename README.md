# HOWTOM 콘텐츠 제작소 — PHASE 2A · 블로그 제작

HOWTOM 유니버스에서 콘텐츠 기능을 별도 웹앱으로 안전하게 분리하는 프로젝트입니다.
PHASE 1의 앱 분리 기반 위에 **블로그 제작 기능 하나만** 실제 기능으로 이전했습니다.

## 현재 실제 구현 범위

- Content Studio 별도 React 앱
- HOWTOM 관리자 로그인
- Universe와 같은 PostgreSQL 공유
- 같은 `advertiser_id` 사용
- 광고주 선택 `전체 보기` / 개별 광고주
- Universe ↔ Content Studio App Switcher
- **블로그 프로젝트 목록/생성/수정/삭제**
- **광고주별 블로그 문체 프로필 저장**
- **블로그용 사진 자산 메타데이터 저장**
- SEO 사전 점검
- 업종별 표현/의료광고 사전 점검
- 심의 완료 문안 잠금/재검토
- TXT/HTML 내보내기
- Desktop / Tablet / Mobile 반응형

## 아직 Stub으로 유지하는 기능

- 레퍼런스 탐색 / 경쟁사 모니터링 / 보드 / 수집 설정
- 광고 제작
- 이미지 제작
- 영상 대본
- 문서 작성
- 제작물 보관함
- 콘텐츠 캘린더
- 템플릿
- 이미지/영상/문서 자산 메뉴
- 자동 수집 Worker

이 기능들은 한꺼번에 구현하지 않습니다.

## AI 정책

PHASE 2A에서는 **새로운 AI API를 연결하지 않습니다.**

- `/api/blog/ai-status` → `configured: false`
- 블로그 화면의 `초안 만들기` 버튼은 AI가 연결되기 전까지 비활성화
- 직접 작성/편집/저장/SEO/규정 점검은 정상 사용 가능
- 향후 여러 제작 메뉴가 준비된 뒤 공통 **AI Gateway**로 연결

즉 블로그 데이터 저장과 업무 흐름을 먼저 완성하고 AI는 후순위로 둡니다.

## 기존 Universe 블로그 데이터

Content Studio는 Universe와 **동일 PostgreSQL의 기존 테이블을 그대로 사용**합니다.

- `blog_projects`
- `blog_styles`
- `blog_assets`
- `advertisers`

따라서 기존 Universe에서 작성한 블로그 데이터가 같은 DB에 있다면 별도 복사 없이 Content Studio에서도 조회합니다.

PHASE 2A 검증이 끝나기 전까지 Universe의 기존 블로그 메뉴/코드는 삭제하지 않습니다.

## 광고주 범위 선택

상단 광고주 선택기는 다음 범위를 제공합니다.

- `전체 보기`: 접근 가능한 모든 광고주
- 개별 광고주: 해당 `advertiser_id` 하나

블로그 목록도 전체 보기 상태에서는 모든 광고주의 프로젝트를 볼 수 있습니다.
특정 광고주를 상단에서 선택하면 블로그 화면의 광고주 필터도 해당 광고주로 맞춰집니다.
새 글을 만들 때는 반드시 실제 광고주 하나를 선택해야 합니다.

## 실행

```bash
npm ci
npm run typecheck
npm run build
npm start
```

개발:

```bash
npm run dev
```

## 필수 환경변수

`.env.example`을 참고합니다.

- `DATABASE_URL`: Universe와 같은 PostgreSQL
- `JWT_SECRET`: Universe와 같은 값
- `HOWTOM_ADMIN_EMAIL`
- `HOWTOM_ADMIN_PASSWORD`
- `HOWTOM_ADMIN_NAME`
- `VITE_UNIVERSE_URL`: Content Studio → Universe 이동 URL
- `PORT`: Railway가 보통 자동 주입

Universe에는 `VITE_CONTENT_STUDIO_URL`을 유지합니다.

## API

공통:

- `GET /api/health`
- `POST /api/login`
- `GET /api/advertisers`

블로그:

- `GET /api/blog/projects`
- `POST /api/blog/projects`
- `GET /api/blog/projects/:id`
- `PATCH /api/blog/projects/:id`
- `DELETE /api/blog/projects/:id`
- `GET /api/blog/styles/:advertiserId`
- `PUT /api/blog/styles/:advertiserId`
- `GET /api/blog/assets`
- `POST /api/blog/assets`
- `GET /api/blog/ai-status`
- `POST /api/blog/generate` — 현재 AI 후순위 정책 때문에 비활성

## 데이터 원칙

- 콘텐츠 프로젝트의 Source of Truth는 PostgreSQL입니다.
- localStorage를 블로그 프로젝트 저장소로 사용하지 않습니다.
- 기존 외부 블로그 연동 UI의 연결 설정은 현재 브라우저 로컬 설정으로 남아 있으며, 핵심 원고/프로젝트 데이터와는 분리되어 있습니다. 이 연동 설정은 외부 발행 기능을 고도화할 때 서버 저장 방식으로 이전합니다.
- `.env`, `.git`, `node_modules`, `.data`, `dist`는 Git/배포 소스 ZIP에 포함하지 않습니다.

## Railway

Content Studio 서비스:

- Build: `npm run build`
- Start: `node server.mjs`
- Healthcheck: `/api/health`

`DATABASE_URL`은 기존 Universe가 사용하는 PostgreSQL과 같은 값을 사용합니다.

## 이번 단계 완료 조건

- TypeScript 검사 통과
- 블로그 실제 라우트 `/production/blog` 활성화
- 다른 PHASE 2 메뉴는 Stub 유지
- 동일 advertisers / advertiser_id 사용
- 블로그 CRUD가 PostgreSQL을 사용하도록 구현
- AI 미연결 상태를 가짜 규칙 기반 생성으로 대체하지 않음
- Universe 광고 API/Central Metrics 코드는 수정하지 않음

## 다음 단계

PHASE 2B는 **광고 제작** 하나만 이전합니다.
그 다음 영상 대본 → 문서 작성 → 제작물 보관함 → 콘텐츠 캘린더 → 템플릿/자산 순서로 진행합니다.
레퍼런스 수집은 콘텐츠 제작 기능 이전이 안정화된 뒤 별도 PHASE에서 진행합니다.
