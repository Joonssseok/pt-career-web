# 승인된 프로필 5개 child table 편집 확장 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: PR #34 보고서 3절에서 CTO 확인 요청했던 항목 — `experiences`/`educations`/`licenses`/`workplaces`/`profile_specialties` 5개 child table도 승인된 프로필에서 편집 가능하게 하고, 편집 시 `save_own_profile()`과 동일하게 프로필을 재검토 대기 상태로 전환.

---

## 1. RLS 정책 12개 변경 diff

`experiences`/`educations`/`licenses`/`workplaces` 4개 테이블 × `owner_insert`/`owner_update`/`owner_delete` 3개 정책. 조건절만 변경(그 외 구조 동일):

```diff
- AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
+ AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
```

`profile_specialties`는 owner가 테이블에 직접 쓰지 않고 `replace_profile_specialties()` RPC(`SECURITY DEFINER`, RLS 우회)로만 쓰므로 이 테이블의 RLS 정책 자체는 변경하지 않았습니다(지시서 2-1 그대로).

## 2. 신규 트리거 함수 정의

```sql
CREATE OR REPLACE FUNCTION public.demote_profile_if_approved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF auth.uid() IS NULL OR is_admin(auth.uid()) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_profile_id := OLD.profile_id;
  ELSE
    v_profile_id := NEW.profile_id;
  END IF;

  UPDATE public.profiles
  SET verification_status = 'pending',
      is_public = false,
      approved_at = NULL,
      submitted_at = now()
  WHERE id = v_profile_id AND verification_status = 'approved';

  RETURN COALESCE(NEW, OLD);
END;
$$;
```

`experiences`/`educations`/`licenses`/`workplaces`/`profile_specialties` 5개 테이블 모두에 `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW`로 부착.

### 구현 중 발견한 이슈 — 스킵 조건이 `service_role`을 놓침

지시서 2-2가 제시한 스킵 조건은 `is_admin(auth.uid())`뿐이었는데, 로컬 검증에서 기존 `p0-anon-column-grants.test.ts`(4건)와 `m3a-child-state-gate.test.ts`(1건) 총 5건이 실패했습니다. 원인: 이 테스트들의 픽스처 설정이 `service_role` 클라이언트로 승인된 프로필의 `workplaces`/`experiences`를 직접 갱신하는데, `service_role` 호출 시 `auth.uid()`는 `NULL`이고 `is_admin(NULL)`은 `admin_users`에 매칭되는 행이 없어 `FALSE`를 반환합니다 — 즉 관리자로 인식되지 않아 매번 트리거가 발동해 테스트가 설정해둔 `approved` 상태를 즉시 `pending`으로 되돌려버렸습니다.

`protect_profile_columns()` 트리거가 이미 정확히 이 문제를 `IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid())`로 처리하고 있었으므로, 동일한 가드를 그대로 채용해 `IF auth.uid() IS NULL OR is_admin(auth.uid())`로 수정했습니다. 실제 프로덕션의 관리자 검토 흐름(`review_expert_profile()`)은 관리자 본인의 JWT로 `auth.uid()`가 채워지므로 이 변경으로 영향받지 않으며, `service_role`을 쓰는 백엔드 스크립트/픽스처/향후 관리자 도구만 스킵 대상에 추가됐습니다.

## 3. `replace_profile_specialties()` RPC 변경 diff

```diff
- IF v_status NOT IN ('draft', 'rejected') THEN
+ IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow specialty modification'::TEXT;
```

## 4. `licenses` 개별 승인상태 처리 방침 — 기본값 채택

지시서 2-4의 권장 기본값대로, **개별 `licenses.verification_status`/`is_public`은 건드리지 않습니다.** 근거: 프로필 전체가 `pending`으로 돌아가면 관리자가 자격증을 포함한 전체를 다시 검토하므로, 개별 필드를 별도로 리셋하지 않아도 재검토 절차상 허점이 생기지 않습니다.

**단, 이 방침의 실제 부작용을 확인했습니다**: `app/admin/[id]/page.tsx:158`에서 각 자격증 옆에 자체 `verification_status`를 그대로 배지로 노출하고 있어(`({l.verification_status})`), 승인된 프로필의 자격증을 수정해 프로필이 재검토 대기로 돌아간 뒤에도 관리자 화면에는 예전 `verified` 배지가 수정된 내용과 함께 남아있을 수 있습니다. 이번 라운드에서는 UI를 추가로 손대지 않고 이 제약을 문서로만 남깁니다(지시서 2-4가 명시적으로 허용한 최소 옵션) — 관리자는 프로필이 `pending`으로 재진입했다는 사실 자체(대시보드/대기열)로 "재검토가 필요한 상태"임을 알 수 있고, 개별 자격증 배지는 참고 정보일 뿐 최종 판단 기준이 아니라는 전제입니다.

## 5. UI 반영 및 라우팅 결정

경력/교육/자격·면허/근무기관/전문분야 5개 온보딩 스텝 화면 모두에 `/expert/edit`과 동일한 톤의 Warning 배너("확인 필요 — 수정 후 저장하면 프로필이 다시 관리자 검토 상태로 전환됩니다")를 추가했습니다. 각 화면이 `getOwnProfile()`로 `verification_status`를 조회해 `approved`일 때만 노출합니다(새 컴포넌트 없이 기존 인라인 배너 스타일 재사용).

**라우팅 결정**: `/expert/edit`의 `EDIT_SECTIONS`를 5개 섹션으로 확장하는 대신, **기존 온보딩 스텝 화면(`/expert/onboarding/*`)을 그대로 재진입 경로로 사용**하기로 했습니다. 근거:
- 각 스텝 화면은 이미 다중 항목 추가/수정/삭제, 파일 업로드 등 완전한 UI를 갖추고 있어, `/expert/edit`에 이를 전부 재구현하면 순수한 코드 중복입니다.
- 온보딩 스텝 화면 자체에는 프로필 상태를 이유로 접근을 막는 로직이 원래 없었으므로(단지 child table의 RLS가 막고 있었을 뿐), 이번 RLS/트리거 변경만으로 기존 화면이 그대로 "승인 후 편집 화면"으로 동작합니다 — 별도의 새 라우트/컴포넌트가 필요 없습니다.
- `/my`의 승인 카드에 "경력·교육·자격·근무기관·전문분야 수정하기" 링크(→ `/expert/onboarding`)를 추가하고, `/expert/edit`의 안내 문구도 "다음 라운드에서 지원 예정"에서 온보딩 화면으로의 실제 링크로 갱신했습니다.

구조 변경이 크지 않다고 판단해 별도 승인 없이 이 방식으로 진행했습니다. 더 통합된 단일 편집 화면을 원하시면 별도 라운드로 지시해주세요.

## 6. 검증 (실제 로컬 계정 + 스크립트, mock 없음)

### 6-1. 5개 테이블 각각 실측 재현 (스크립트)

신규 계정 1개로 각 테이블에 대해 "재승인 → 소유자 세션으로 쓰기 → 프로필 상태 재조회"를 반복:

| 테이블 | 동작 | 결과 |
|---|---|---|
| `experiences` | INSERT | 성공, 프로필 `pending`/`is_public=false`/`approved_at=NULL`/`submitted_at` 갱신 확인 |
| `educations` | INSERT | 동일 |
| `licenses` | INSERT | 동일 + 자격증 자체 `verification_status`는 `not_submitted`(기본값)로 **불변** 확인(4절 방침 실증) |
| `workplaces` | INSERT | 동일 |
| `profile_specialties` | `replace_profile_specialties()` RPC | `{ok:true}` + 동일 프로필 전환 확인 |

### 6-2. `pending` 상태 회귀 확인

위 스크립트에서 프로필을 `pending`으로 고정한 뒤: `experiences` 직접 INSERT → RLS 위반 에러(정상 차단), `replace_profile_specialties()` 호출 → `{ok:false, error:'Profile status does not allow specialty modification'}`(정상 차단). 기존 동작 그대로 유지됨을 확인.

### 6-3. `protect_profile_columns()` 상호작용

위 모든 케이스에서 트리거의 `profiles` UPDATE가 예외 없이 통과함을 확인(모든 스크립트 호출의 `error`가 `null`) — PR #34에서 이미 whitelist된 `approved → pending` + `is_public=false` + `approved_at=NULL` 패턴과 정확히 일치하도록 구현했기 때문입니다.

### 6-4. 실제 브라우저 종단 검증

승인된 테스트 프로필로 로그인 → `/expert/onboarding/experience` 진입 시 "확인 필요" 배너 노출 확인 → 경력 1건 추가 후 저장 → `/my` 재방문 시 "현재 관리자 검토 중입니다"로 즉시 전환됨을 실제 화면에서 확인.

### 6-5. 회귀 확인

기존 `m3a-child-state-gate.test.ts`의 "owner CANNOT update or delete ... while approved" 테스트는 이번 지시서가 의도적으로 뒤집는 동작이므로, "owner CAN update ... which demotes the profile back to pending"으로 재작성하고 pending 전환/재승인 유지 등을 함께 검증하도록 확장했습니다.

| 항목 | 결과 |
|---|---|
| `pnpm test`(로컬 Supabase, 44개) | ✅ 44/44 통과 (트리거 스킵조건 수정 전에는 5건 실패 — 5절 참고) |
| `tsc --noEmit` | ✅ 에러 없음 |
| `pnpm build` | ✅ 성공 |

### 6-6. 프로덕션 적용

- 백업: [`backup_pre_child_table_edit_expansion_20260730.sql`](../../backup_pre_child_table_edit_expansion_20260730.sql) — 12개 정책 원본 + `replace_profile_specialties()` 원본 정의(+ 참고용 `profile_specialties` 3개 정책도 포함, 이번엔 미변경).
- 마이그레이션 적용 후 12개 정책 조건에 `approved` 포함 확인, 5개 트리거 존재 확인.
- `get_advisors(security)` 재실행 — 신규 이슈 없음(기존과 동일한 패턴의 WARN만 유지, `demote_profile_if_approved()`는 RPC로 노출되지 않는 트리거 함수라 advisor 목록에 자체적으로 나타나지 않음).
- 프로덕션에는 실계정을 만들지 않았습니다(이번 세션 정책 유지) — 6-1~6-4는 모두 로컬 Supabase에서 수행.

---

## 7. 완료 기준 체크

- [x] 12개 RLS 정책 변경 diff, 신규 트리거 함수 정의, RPC 변경 diff 문서화
- [x] `licenses` 처리 방침(기본값 채택) 및 근거 명시 + 관리자 UI 배지 관련 제약 사항 기록
- [x] 5개 테이블 각각 실측 재현 절차와 결과
- [x] 백업 파일 경로
- [x] pending 회귀 확인, `protect_profile_columns()` 상호작용 확인
- [x] `pnpm test`/`tsc`/`pnpm build` 통과
- [x] `get_advisors(security)` 재확인 — 신규 이슈 없음
