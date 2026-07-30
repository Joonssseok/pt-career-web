# 자격증/면허 개별 육안심사 + 인증 배지 노출 + 증빙서류 영구보관·다운로드 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (로컬 검증 완료, 프로덕션 미적용 — 8절 참고)

---

## 0. 배경 재확인

지시서가 지목한 구조적 공백은 실제였습니다: `review_expert_profile()`은 `profiles.verification_status`만 바꾸고 `licenses.verification_status`/`licenses.is_public`은 어디에서도 세팅되지 않았습니다. 그 결과 `get_public_licenses()`(PR #41, `verification_status='verified' AND is_public=true` 필터)는 단 한 번도 행을 반환한 적이 없었고, 공개 프로필의 "인증됨" 배지는 출시 이후 죽은 기능이었습니다. 이번 작업으로 이 배지가 **처음으로 실제 데이터에 대해 동작**하는 것을 실측했습니다(4절).

`admin_actions.target_license_id` 컬럼과 `action_type` CHECK의 `'license_verified'`/`'license_rejected'` 값은 이미 스키마에 존재했으나 미사용 상태였음을 확인 — 신규 컬럼/테이블 없이 그대로 재사용했습니다.

## 1. `review_license()` RPC (신규)

`supabase/migrations/20260730080000_license_review.sql`:

```sql
CREATE OR REPLACE FUNCTION public.review_license(
  p_license_id uuid,
  p_decision text,
  p_memo text DEFAULT NULL
)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_profile_id uuid;
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Only admins can review licenses'::TEXT; RETURN;
  END IF;

  IF p_decision NOT IN ('verified', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Decision must be verified or rejected'::TEXT; RETURN;
  END IF;

  SELECT profile_id INTO v_profile_id FROM public.licenses WHERE id = p_license_id;
  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'License not found'::TEXT; RETURN;
  END IF;

  UPDATE public.licenses
  SET verification_status = p_decision,
      is_public = (p_decision = 'verified')
  WHERE id = p_license_id;

  INSERT INTO public.admin_actions (admin_user_id, target_profile_id, target_license_id, action_type, memo)
  VALUES (
    v_admin_id, v_profile_id, p_license_id,
    CASE WHEN p_decision = 'verified' THEN 'license_verified' ELSE 'license_rejected' END,
    p_memo
  );

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.review_license(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_license(uuid, text, text) TO authenticated;
```

프로필의 승인 상태와 무관하게 동작하도록 설계했고(별도 순서 요구 없음), `is_admin(v_admin_id)`으로 관리자만 실행 가능하게 제한했습니다.

## 2. `get_admin_audit_log()` 확장

같은 마이그레이션에서 `action_type` 필터에 `'license_verified'`/`'license_rejected'`를 추가하고, `licenses`를 LEFT JOIN해 `target_license_name` 컬럼을 반환하도록 확장했습니다.

> Postgres는 `RETURNS TABLE`의 컬럼 구성이 바뀌면 `CREATE OR REPLACE FUNCTION`을 거부합니다(`42P13 cannot change return type of existing function`) — `DROP FUNCTION IF EXISTS ...` 후 재생성으로 처리했습니다.

`app/actions/admin.ts` 변경:
- `AdminAuditLogEntry.action_type` 유니언에 `'license_verified' | 'license_rejected'` 추가, `target_license_name: string | null` 필드 추가.
- `getAdminAuditLog()`의 `actionType` 파라미터 타입 동일 확장.
- `reviewLicense(licenseId, decision, memo?)` 신규 — `review_license` RPC 래퍼.

`app/admin/AuditLog.tsx` 변경:
- `ACTION_LABEL`에 `license_verified: '자격증 인증'`, `license_rejected: '자격증 반려'` 추가.
- 색상 판정을 `e.action_type === 'profile_approved'` 단일 비교에서 `APPROVAL_ACTION_TYPES = new Set(['profile_approved', 'license_verified'])` 기반으로 교체.
- 필터 `<select>`에 "자격증 인증"/"자격증 반려" 옵션 추가.
- 항목 표시에 `target_license_name`이 있으면 `· {license명}`을 이어 붙이도록 추가.

## 3. 관리자 UI — `LicenseReviewActions`

`app/admin/[id]/LicenseReviewActions.tsx` 신규 컴포넌트를 `app/admin/[id]/page.tsx`의 자격증 목록에 항목별로 배치했습니다. 현재 `verification_status`를 배지로 표시하고(`not_submitted`/`pending`은 "미검토"로 동일 취급), "인증"/"반려" 버튼은 이미 결정된 항목에도 항상 활성 상태로 두어 재조정(예: 인증→반려)이 가능합니다. 프로필 승인 여부와 무관하게 `/admin/[id]` 페이지 자체가 이미 항상 로드되므로 별도 게이팅을 추가하지 않았습니다.

## 4. 본인 화면 배지 + 공개 프로필 배지 — 실측 결과

`getOwnCertifications()`가 `verification_status`를 select+반환하도록 확장했고, `CertificationSection.tsx`에 `LICENSE_STATUS_META`(`AccountSidebar.tsx`의 `STATUS_META`와 동일한 톤 패턴)로 배지를 렌더링했습니다.

로컬 테스트 계정(전문가: `license-expert-check@example.com`, 관리자: `license-admin-check@example.com`)으로 실제 시나리오를 검증했습니다:

| 단계 | 결과 |
|---|---|
| 전문가가 NASM-CPT, ACE-CPT 2건 등록 | 둘 다 "검토 대기" |
| 관리자가 `/admin/{id}`에서 NASM-CPT만 "인증" 클릭 | 본인 화면: NASM-CPT "인증됨" / ACE-CPT "검토 대기" 로 즉시 분리 표시 |
| **공개 프로필(`/experts/{id}`) 확인 — PR #41 이후 최초 실측** | NASM-CPT만 "✓ 인증됨" 배지와 함께 표시, ACE-CPT는 목록에서 완전히 제외됨 — `get_public_licenses()`가 처음으로 실제 행을 반환하는 것을 확인 |
| 승인된 프로필 상태에서 자격증 화면 재저장(다른 자격증 수정) | `demote_profile_if_approved_trigger`가 프로필을 `pending`+비공개로 전환, `save_own_licenses()`의 DELETE+INSERT로 NASM-CPT/ACE-CPT 모두 `not_submitted`로 리셋 |
| 리셋 직후 공개 프로필 URL 재방문 | 즉시 404 — 라이선스 배지뿐 아니라 프로필 전체가 `public_expert_detail`(`is_public=true AND verification_status='approved'` 조건)에서 사라짐. 지시서가 예측한 "harmless" 동작과 정확히 일치 |

`app/experts/[id]/page.tsx`에는 하드코딩된 "✓ 인증됨" 배지를 추가했습니다 — `get_public_licenses()`가 이미 `verified AND is_public=true`만 반환하므로 이 목록에 나오는 항목은 전부 관리자 인증을 거친 것이 보장됩니다.

## 5. "제출 서류함" — 증빙서류 영구보관 + 다운로드

- `app/actions/evidence-files.ts` 신규: `listOwnEvidenceFiles()` — `supabase.storage.from('evidence-files').list(user.id)`로 본인 폴더 전체를 나열. 새 DB 테이블 없음(Storage 자체가 원장).
- `components/EvidenceFileArchive.tsx` 신규: 파일명·업로드일·용량과 함께 `getEvidenceFileUrl()` 기반 다운로드 링크 목록 UI.
- `app/my/page.tsx`에 배치.

**Storage 삭제 로직 미추가 확인**: 이번 작업 전체에서 `storage.remove()` 또는 이에 준하는 삭제 호출을 어디에도 추가하지 않았습니다(지시서 3절의 명시적 금지 사항).

실측: 자격증 화면에서 ACE-CPT 항목을 삭제 후 재저장 → `licenses` 테이블에서는 해당 행이 사라졌지만, 대응하는 PDF 파일은 `storage.objects`에 그대로 남아있고 "제출 서류함"에서 여전히 목록/다운로드 가능함을 확인했습니다. 기존 "📎 증빙 파일 보기" 링크(`getEvidenceFileUrl`, `/api/evidence-file/[...path]` 프록시)도 검증 상태와 무관하게 계속 노출됨을 재확인했습니다(코드 변경 없음 — 기존 RLS 경로 그대로).

## 6. 감사 로그 — 실측 및 필터 확인

관리자 계정으로 `/admin`에 로그인해 확인:

- NASM-CPT 인증 직후 감사 로그에 `자격증 인증`(녹색) 항목이 대상 프로필명·처리 관리자·시각과 함께 즉시 나타남.
- 필터 드롭다운에서 "자격증 인증"을 선택하고 조회 → `profile_approved` 항목은 사라지고 `license_verified` 항목만 남는 것을 확인(필터 정상 동작).

**발견한 부수 현상 (버그 아님)**: 이후 진행한 "리셋 사이클" 테스트(4절)에서 `save_own_licenses()`의 DELETE+INSERT가 원본 NASM-CPT 라이선스 행을 삭제했고, `admin_actions.target_license_id`의 기존 FK(`ON DELETE SET NULL`, 이번 작업 이전부터 존재)가 자동으로 해당 감사 로그 항목의 `target_license_id`를 NULL로 만들었습니다. DB로 직접 확인:

```
action_type: license_verified, target_license_id: null, target_profile_id: 8176cfba-...
```

이 때문에 리셋 이후에는 감사 로그의 `target_license_name`이 비어 보입니다. `action_type`/관리자/시각/대상 프로필명은 그대로 유지되므로 감사 이력 자체는 손실되지 않지만, 라이선스명은 원본 라이선스 행이 나중에 재저장으로 교체되면 사라질 수 있습니다. 이는 기존 FK 설계와 지시서가 "harmless"로 명시한 `save_own_licenses()` DELETE+INSERT 패턴(변경 금지 대상)의 자연스러운 결과이며, 이번 작업이 새로 만든 결함이 아닙니다. 별도 조치 없이 사실만 기록합니다.

## 7. 로컬 검증

- `supabase db advisors --local --type security --level error --fail-on none` → **이슈 없음**.
- `pnpm test` → **53/53 PASS**.
- `tsc --noEmit` → 클린.
- `pnpm build` → 성공.
- 테스트 계정(`license-expert-check@example.com`, `license-admin-check@example.com`) 및 관련 `profiles`/`licenses`/`admin_actions`/Storage 파일 정리 완료.

## 8. 프로덕션 미적용 — 확인 요청

이번 라운드 작업 계획(태스크 목록)에 "프로덕션 적용" 단계가 별도로 포함되어 있지 않았고, 지시서 본문에도 배포 지시가 없어 **로컬 검증까지만 진행**했습니다. 마이그레이션(`20260730080000_license_review.sql`)을 프로덕션에 적용할지, 이번 PR을 병합/배포할지는 별도로 확인 부탁드립니다.

## 9. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `supabase/migrations/20260730080000_license_review.sql` | 신규 — `review_license()` RPC, `get_admin_audit_log()` 확장 |
| `app/actions/admin.ts` | `reviewLicense()` 추가, 타입 확장 |
| `app/actions/certification.ts` | `getOwnCertifications()`에 `verification_status` 포함 |
| `app/actions/evidence-files.ts` | 신규 — `listOwnEvidenceFiles()` |
| `app/admin/AuditLog.tsx` | 라벨/필터/표시 확장 |
| `app/admin/[id]/LicenseReviewActions.tsx` | 신규 — 관리자 개별 인증/반려 버튼 |
| `app/admin/[id]/page.tsx` | `LicenseReviewActions` 배치 |
| `app/experts/[id]/page.tsx` | "✓ 인증됨" 배지 |
| `app/my/page.tsx` | `EvidenceFileArchive` 배치 |
| `components/EvidenceFileArchive.tsx` | 신규 — 제출 서류함 UI |
| `components/profile-sections/CertificationSection.tsx` | 본인 화면 검증 상태 배지 |
