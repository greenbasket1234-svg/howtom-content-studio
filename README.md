# HOWTOM 콘텐츠 제작소 — PHASE 1

HOWTOM 유니버스에서 콘텐츠 기능을 별도 웹앱으로 안전하게 분리하기 위한 **기반 단계**입니다.
현재 PHASE 1에서는 콘텐츠/레퍼런스 기능을 실제 구현하지 않습니다.

## 현재 구현 범위

- 별도 Content Studio React 앱
- 기존 HOWTOM 관리자 계정과 같은 환경변수를 사용하는 로그인
- 기존 HOWTOM PostgreSQL의 `advertisers` 목록 읽기
- Universe와 동일한 `advertiser_id` 사용
- Universe ↔ Content Studio App Switcher
- Content Studio 홈
- 향후 메뉴 라우팅 Stub
- Desktop / Tablet / Mobile 반응형

## 현재 구현하지 않는 범위

PHASE 1에서는 아래 기능을 의도적으로 활성화하지 않습니다.

- 레퍼런스 수집/경쟁사 모니터링/보드
- 광고 제작
- 블로그 제작
- 이미지 제작
- 영상 대본
- 문서 작성
- 제작물 보관함
- 콘텐츠 캘린더
- 템플릿
- 자산관리
- AI API
- 자동 수집 Worker

기존 Universe의 콘텐츠 기능은 PHASE 2 이전이 완료되기 전까지 그대로 유지합니다.

## 서비스 역할

| 앱 | 역할 |
|---|---|
| HOWTOM Universe | 광고 운영, 광고 API, Central Metrics, 인사이트, 보고서 |
| HOWTOM Content Studio | 콘텐츠/레퍼런스 기능을 단계적으로 이전할 별도 앱 |
| PostgreSQL | 두 앱이 공유하는 공통 DB |

Content Studio는 별도 광고주 DB를 만들지 않습니다.
`/api/advertisers`가 기존 `advertisers` 테이블을 읽으며 Universe와 동일한 ID를 사용합니다.

## 실행

```bash
npm ci
npm run typecheck
npm run build
npm start
```

개발 시:

```bash
npm run dev
```

Vite 개발 서버의 `/api` 요청은 `vite.config.ts` 설정에 따라 Content Studio API 서버로 전달됩니다.

## 필수 환경변수

`.env.example`을 참고합니다.

- `DATABASE_URL`: Universe와 같은 PostgreSQL
- `JWT_SECRET`: Universe와 같은 값
- `HOWTOM_ADMIN_EMAIL`: Universe와 같은 값
- `HOWTOM_ADMIN_PASSWORD`: Universe와 같은 값
- `HOWTOM_ADMIN_NAME`: 표시 이름
- `VITE_UNIVERSE_URL`: Content Studio → Universe 이동 URL
- `PORT`: Railway가 보통 자동 주입

Universe 쪽에는 다음 빌드 변수가 필요합니다.

- `VITE_CONTENT_STUDIO_URL`: Universe → Content Studio 이동 URL

## PHASE 1 API

### `GET /api/health`
서비스 상태를 확인합니다.

### `POST /api/login`
관리자 로그인을 수행합니다.

### `GET /api/advertisers`
인증 후 공통 PostgreSQL의 광고주 목록을 읽습니다.

그 외 `/api/*`는 PHASE 1에서 `404`를 반환합니다.

## 라우트

실제 기능은 아직 Stub이지만 향후 위치를 고정하기 위해 라우팅 골격을 유지합니다.

- `/` 홈
- `/references*` PHASE 3
- `/production/*` PHASE 2
- `/library`, `/calendar`, `/templates` PHASE 2
- `/assets/*` PHASE 2

## 배포

권장 초기 Railway 구조:

1. 기존 Universe 서비스
2. Content Studio 서비스
3. 기존 PostgreSQL

Reference Worker는 자동 수집이 실제로 필요해지는 후속 단계에서 추가합니다.

Content Studio 서비스 설정 예:

- Build: `npm run build`
- Start: `node server.mjs`
- Healthcheck: `/api/health`

## 유지보수 원칙

- Universe의 광고 API/Central Metrics 코드를 Content Studio에 복제하지 않습니다.
- Content Studio PHASE 2 기능은 승인 후 하나씩 이전합니다.
- localStorage를 콘텐츠 데이터 Source of Truth로 사용하지 않습니다.
- `.env`, `.git`, `node_modules`, `.data`는 배포 ZIP/Git에 포함하지 않습니다.
- README 설명과 실제 코드는 항상 같은 상태로 유지합니다.
- PHASE 1 승인 전 PHASE 2/3 기능을 선행 구현하지 않습니다.

## 다음 단계

PHASE 1 승인 후 PHASE 2에서 기존 콘텐츠 기능을 **한 번에 전부가 아니라 기능 단위로** 이전합니다.
권장 순서:

1. 블로그 제작
2. 광고 제작
3. 영상 대본
4. 문서 작성
5. 제작물 보관함
6. 콘텐츠 캘린더
7. 템플릿/자산

레퍼런스 수집은 PHASE 3에서 별도로 구현합니다.
