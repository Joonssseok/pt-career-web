# 운영 모니터링 체크리스트 (1인 창업 초기 단계용 최소 안전망)

**작성일**: 2026-07-28
**목적**: Sentry 같은 유료/외부 옵저버빌리티 스택 없이, 지금 있는 도구(Supabase MCP, Vercel MCP, `/api/health`)만으로 주기적으로 확인해야 할 최소 체크리스트.
**주기 제안**: 매주 1회, 또는 사용자 문의/이상 징후가 있을 때마다.

---

## 1. Supabase Advisors 재실행

```
mcp__<supabase>__get_advisors(project_id, type: "security")
mcp__<supabase>__get_advisors(project_id, type: "performance")
```

- **확인할 것**: 새로 생긴 `ERROR`/`WARN` 항목이 있는지. 특히 새 마이그레이션을 적용한 직후엔 반드시 재실행.
- **기준**: 기존에 알려진 항목(예: `security_definer_view` on `public_expert_list`/`public_expert_detail`, `auth_otp_long_expiry`, `auth_leaked_password_protection`)은 이미 인지된 상태 — 새 항목만 조사 대상.

## 2. Vercel 런타임 에러/로그 조회

```
mcp__<vercel>__get_runtime_logs(projectId) / get_runtime_errors(projectId)
```

- **확인할 것**: `console.error`로 남기게 되어 있는 서버 액션(`app/actions/*.ts`)·API 라우트(`app/api/*/route.ts`, `app/auth/callback/route.ts`)의 에러가 실제로 쌓여 있는지.
- 사용자가 "안 된다"고 문의했을 때 가장 먼저 볼 곳.

## 3. `/api/health` 상태 확인

- URL: `<배포 도메인>/api/health`
- 정상: `200 { "ok": true }`
- Supabase 연결 실패 시: `503 { "ok": false }` (Vercel 런타임 로그에 `[health] ...` 에러도 함께 남음)
- **참고**: 이 엔드포인트는 무료 외부 uptime 모니터링 서비스(UptimeRobot 등)에 등록해 다운타임을 자동으로 알림받는 용도로 만들어졌습니다. 실제 서비스 가입/등록은 대표님이 직접 진행.

## 4. `admin_actions` 최근 기록 확인

```sql
SELECT * FROM admin_actions ORDER BY created_at DESC LIMIT 20;
```

- **확인할 것**: 승인/반려 처리가 실제로 기록되고 있는지, 의도치 않은 대량 반려/승인이 없는지.

## 5. (참고, 이번 범위 밖) 대표님이 직접 할 일

- Vercel Web Analytics 대시보드에서 활성화 여부 확인/토글.
- `/api/health`를 UptimeRobot 등 무료 서비스에 등록.
- 필요해지면 Sentry 등 본격 에러 추적 도입 (별도 지시서로 진행).

---

## 부록: 이번 점검에서 확인한 사실

- `public.admin_actions`는 `review_expert_profile()` 함수(PR #16)에서 이미 정상적으로 기록되고 있음 — 추가 작업 불필요.
- `app/actions/*.ts`(6개 파일), `app/api/*/route.ts`(2개), `app/auth/callback/route.ts`(1개, 동일한 침묵 catch 패턴이라 범위를 살짝 넓혀 함께 수정)의 에러 처리 지점에 `console.error` 로깅을 최소한으로 추가함 — 자세한 내용은 [MONITORING_SETUP_2026_07_28.md](MONITORING_SETUP_2026_07_28.md) 참고.
