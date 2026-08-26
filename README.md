# HOWTOM 콘텐츠 제작소

HOWTOM 유니버스(광고 운영)에서 콘텐츠 관련 기능을 분리한 독립 웹앱입니다.
유니버스와 같은 PostgreSQL, 같은 `advertiser_id`를 공유하지만 서버는 완전히 분리되어 있습니다.

> 상세 제품 정의·상태 기준·우선순위는 저장소 루트의 `PRD.md`를 참고하세요.
> 이 README는 "이 프로젝트를 어떻게 실행·배포하는가"에 집중합니다.

## 현재 구현 범위 (2026-08-26 기준)

| 영역 | 기능 | 비고 |
|---|---|---|
| 기반 | 앱 분리, 공통 광고주 선택, Universe ↔ 상호 이동 | |
| 제작 | 광고 제작 | `ad_projects` |
| 제작 | 블로그 제작 (SEO·업종별 규정 점검·심의 잠금 포함) | `blog_projects`, `blog_styles`, `blog_assets` |
| 제작 | 영상 대본 (타임라인 편집) | `video_script_projects` |
| 제작 | 문서 작성 (블록 편집) | `document_projects` |
| 제작 | 템플릿 (복제/버전 관리) | `content_templates` |
| 제작 | 자산 (이미지/영상/문서, URL 등록 방식) | `content_assets` |
| 제작 | 제작물 보관함 / 콘텐츠 캘린더 | 위 4개 프로젝트 테이블 통합 조회 |
| 레퍼런스 | 레퍼런스 탐색 (Meta 광고 / YouTube / Instagram 해시태그) | `content_references` |
| 레퍼런스 | 경쟁사 모니터링 (수동 "지금 수집") | `reference_competitors` |
| 레퍼런스 | 레퍼런스 보드 | `reference_boards`, `reference_board_items` |
| 레퍼런스 | 자동 수집 Worker (매일 KST 8·20시) | 서버 내부 스케줄러 |
| AI | 공용 AI Gateway (레퍼런스 AI 분석 등) | Anthropic/OpenAI/custom |
| AI | 블로그 AI 원고 생성 | 제휴 업체 API Adapter 방식 (아래 참고) |

**미구현**: 이미지 제작, TikTok/Threads 커넥터, AI 의미 기반 검색

## AI 정책

콘텐츠 제작소는 AI를 **두 개의 서로 다른 경로**로 나눕니다.

1. **공용 AI Gateway** (`AI_PROVIDER`/`AI_API_KEY`) — 레퍼런스 AI 분석 등 "해석·분석" 용도
2. **블로그 AI 원고 생성** (`BLOG_PARTNER_API_URL`/`BLOG_PARTNER_API_KEY`) — 제휴 업체가 확정되기 전까지는 `/api/blog/generate`가 "연동 필요" 상태를 정직하게 반환합니다. 가짜 원고를 만들어내지 않습니다.

두 경로를 하나로 합치지 않는 이유는, 나중에 블로그 원고 제휴사가 바뀌어도 다른 AI 기능(레퍼런스 분석 등)에 영향이 없도록 하기 위해서입니다.

## 광고주 범위 선택

상단 광고주 선택기는 `전체 보기` / 개별 광고주 두 범위를 제공합니다. 특정 광고주를 선택하면 모든 하위 화면(제작·레퍼런스·자산)이 해당 `advertiser_id`로 필터링됩니다.

## 실행

```bash
npm ci
npm run typecheck
npm run build
npm start
```

개발 서버:

```bash
npm run dev
```

## 환경변수

`.env.example` 참고. 최소 다음 4개는 **Universe와 반드시 같은 값**이어야 합니다.

- `DATABASE_URL`, `JWT_SECRET`, `HOWTOM_ADMIN_EMAIL`, `HOWTOM_ADMIN_PASSWORD`

나머지(레퍼런스 커넥터, AI)는 비워두면 해당 기능이 "연동 필요"로 정직하게 표시되고, 나머지 기능은 정상 동작합니다.

## Railway

- Build: `npm run build`
- Start: `node server.mjs`
- Healthcheck: `/api/health`

## 데이터 원칙

- 모든 프로젝트/레퍼런스 데이터의 Source of Truth는 PostgreSQL입니다. `localStorage`를 업무 데이터 저장소로 쓰지 않습니다.
- API가 제공하지 않는 값은 `0`이 아니라 `null`로 저장/표시합니다.
- `.env`, `.git`, `node_modules`, `dist`는 Git/배포 ZIP에 포함하지 않습니다.

## 자세한 API 목록, 상태 정의, 우선순위

`PRD.md`의 각 기능 섹션과 부록 A(실측 As-Is 현황)를 참고하세요. 새 기능을 AI에게 요청할 때 "PRD.md의 해당 섹션과 Definition of Done을 기준으로 구현"이라고 지정하면 범위가 임의로 커지는 것을 막을 수 있습니다.
