# 모니터링 구축 보고서 (M7 우선순위 6)

**작성일**: 2026-07-28
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: 1인 창업 초기 단계에 맞는 최소 안전망만 구축. Sentry 등 유료 옵저버빌리티 스택, Vercel Analytics 설정, 외부 uptime 서비스 가입, 알림 자동화 인프라는 범위 밖(지시서 4절 그대로).

---

## 1. 헬스체크 엔드포인트 (`GET /api/health`)

`app/api/health/route.ts` 신규 작성. Supabase 연결까지 실제로 확인하는 저비용 쿼리를 수행합니다.

- 정상: `200 { "ok": true }`
- Supabase 쿼리 에러 또는 예외 발생: `503 { "ok": false }` + `console.error`로 원인 로깅

### 쿼리 대상 선정 관련 이슈 발견 및 수정

처음엔 지시서 예시대로 `profiles` 테이블에 `select count(*)`를 시도했는데, **로컬/프로덕션 모두에서 항상 503이 떴습니다**. 원인을 조사해보니 M4 보안 작업(이전 세션)에서 `anon`이 `profiles` 테이블에 대한 직접 SELECT 권한을 아예 갖고 있지 않도록 잠가뒀기 때문이었습니다(`public_expert_list`/`public_expert_detail` 뷰로만 공개 조회하도록 설계된 의도된 상태 — 버그 아님). 헬스체크가 인증되지 않은 `anon` 컨텍스트로 실행되다 보니 이 제약에 그대로 걸린 것입니다.

**조치**: 쿼리 대상을 `anon`이 실제로 읽을 수 있는 작고 정적인 참조 테이블 `specialties`로 변경했습니다. 이렇게 하면 향후 `profiles`/뷰 쪽 RLS가 또 바뀌어도 헬스체크 자체가 영향받지 않습니다.

### 검증 (지시서 5절 요구사항)

| 시나리오 | 결과 |
|---|---|
| 정상 (프로덕션 Supabase 연결) | `200 { "ok": true }` — 실제 프로덕션 Supabase에 대고 직접 확인 |
| DB 장애 (연결 URL을 존재하지 않는 호스트로 임시 교체 후 재시작) | `503 { "ok": false }` + 런타임 로그에 `[health] Supabase check failed: { message: 'TypeError: fetch failed', details: '...getaddrinfo ENOTFOUND...' }` 정상 기록 확인 |

두 시나리오 모두 실측했고, 테스트용 env 오버라이드 파일은 검증 후 즉시 삭제했습니다(레포에 커밋되지 않음, `.gitignore`의 `.env*` 패턴에 포함).

---

## 2. 서버 액션/API 라우트 에러 로깅 점검

`app/actions/*.ts`(6개 파일), `app/api/*/route.ts`(2개)를 전수 점검한 결과, **`catch` 블록은 물론 Supabase 쿼리 에러(`if (error) {...}`) 분기까지 전부 `console.error` 없이 사용자 메시지만 반환하고 있었습니다** — 즉 서버 로그(Vercel 런타임 로그)에는 아무 흔적도 안 남고 있었습니다. "이미 되어 있음"이 아니라 **전체가 누락 상태**였습니다.

### 수정한 파일과 위치

| 파일 | 추가한 지점 |
|---|---|
| `app/actions/admin.ts` | `reviewExpertProfile`: Supabase 에러 1곳 + catch 1곳 |
| `app/actions/certification.ts` | `getOwnCertifications` 에러 1곳, `saveCertifications`: delete/insert 에러 2곳 + catch 1곳 |
| `app/actions/experience.ts` | `getOwnExperiences` 에러 1곳, `saveExperience`: delete/insert 에러 2곳 + catch 1곳 |
| `app/actions/profile.ts` | `getOwnProfile` 에러 1곳, `saveOwnProfile`/`submitProfile` 각 에러 1곳 + catch 1곳 |
| `app/actions/specialties.ts` | `getOwnSelectedSpecialtyIds`/`getSpecialties` 각 에러 1곳, `replaceProfileSpecialties` 에러 1곳 + catch 1곳 |
| `app/actions/workplace.ts` | `getOwnWorkplace` 에러 1곳, `saveWorkplace` 에러 1곳 + catch 1곳 |
| `app/api/evidence-file/[...path]/route.ts` | storage download 에러 시 로깅 (파일 단순 미존재 404와는 별개로, 실제 스토리지 에러가 있을 때만) |
| `app/api/profile-photo/[...path]/route.ts` | 동일 |
| `app/auth/callback/route.ts` (지시서 glob 범위 밖이지만 동일 패턴이라 함께 수정) | 세션 교환 실패 시 이미 `console.error`가 일부 있었으나, 바깥쪽 `catch (err)`는 여전히 조용히 삼키고 있어서 로깅 추가 |

사용자에게 노출되는 메시지(`error.message` 등 안전한 문자열)는 그대로 두고, `console.error`로 원본 에러 객체만 서버 로그에 추가하는 방식으로 — `docs/05_DESIGN_SYSTEM.md`의 "개발자용 에러를 사용자에게 노출하지 않음" 원칙은 그대로 유지했습니다.

**변경하지 않은 것**: `public.admin_actions` 기록 로직(`review_expert_profile()` 함수) — 지시서 0절에서 이미 정상 확인된 부분이라 손대지 않았습니다.

---

## 3. 운영 체크리스트 문서

[`docs/report/OPERATIONS_MONITORING_CHECKLIST.md`](OPERATIONS_MONITORING_CHECKLIST.md) 신규 작성. Supabase Advisors 재실행, Vercel 런타임 로그 조회, `/api/health` 확인, `admin_actions` 최근 기록 확인 4가지를 정기적으로 볼 항목으로 정리했고, 범위 밖인 Vercel Analytics/uptime 서비스 가입은 "대표님이 직접 할 일"로 명시해뒀습니다.

---

## 4. 회귀 확인

| 항목 | 결과 |
|---|---|
| `supabase db reset` | ✅ 정상 (DB 스키마 변경 없음 — 이번 작업은 코드만 변경) |
| 전체 테스트 스위트 (`jest`) | ✅ 43/43 통과 |
| `npm run check` (`tsc --noEmit`) | ✅ 에러 없음 |
| `npm run build` | ✅ 성공, `/api/health` 라우트 정상 포함 확인 |

---

## 5. 완료 기준 체크

- [x] `/api/health` 엔드포인트 정상 동작 — 정상/DB 장애 두 시나리오 모두 실측 확인 (503 재현 포함)
- [x] 에러를 삼키던 곳에 `console.error` 로깅 추가 — 전 지점 누락 상태였음을 확인하고 8개 파일에 추가 (지시서 glob 범위 밖인 `auth/callback` 1곳도 동일 문제라 함께 수정, 근거 명시)
- [x] 운영 체크리스트 문서 1개 추가
- [x] 기존 테스트/빌드 회귀 없음
