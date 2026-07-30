# 전문가 프로필 이미지 갤러리 기능 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (로컬 검증 완료, 프로덕션 미적용 — 8절 참고)

---

## 0. 요약

프로필 사진 1장 + 텍스트 소개만 가능하던 상태에 최대 10장 이미지 갤러리를 추가했습니다. `/expert/edit`에서 업로드/순서변경/캡션/삭제, `/experts/[id]`에서 캐러셀(가로 스와이프)과 풀 갤러리(세로 스크롤) 두 형태로 노출됩니다. **관리자 검토 대상에서 제외되어 업로드 즉시 공개**되며, `demote_profile_if_approved_trigger`를 이 신규 테이블에 절대 붙이지 않음으로써 확정 사항을 지켰습니다.

검증 과정에서 지시서에 없던 실제 결함 하나를 발견해 수정했습니다(6절) — 신규 테이블에 `service_role`의 기본 CRUD 권한이 자동으로 부여되지 않는다는 사실.

## 1. `profile_gallery_images` 테이블 + RLS + GRANT

`supabase/migrations/20260731000000_profile_gallery.sql`에 지시서가 준 SQL 그대로 구현했습니다:

```sql
CREATE TABLE public.profile_gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  caption text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE POLICY owner_all ON public.profile_gallery_images FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY anon_select_public ON public.profile_gallery_images FOR SELECT TO anon
  USING (profile_id IN (SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL));

CREATE POLICY authenticated_select_public ON public.profile_gallery_images FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL));

GRANT SELECT (id, profile_id, image_path, caption, display_order, created_at)
  ON public.profile_gallery_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_gallery_images TO authenticated;
```

`id`는 프론트엔드 React key 용도로 anon/authenticated 컬럼 GRANT에 포함했습니다(지시서가 명시한 트레이드오프 판단 재량 범위).

**교차 확인**: `authenticated_select_public`이 `profiles`/`workplaces`/`experiences`/`educations`/`profile_specialties`에서 이미 제거된 "공개+승인 프로필 authenticated 조회" 패턴과 같은 구조라, `20260730030000_fix_authenticated_column_bypass.sql`이 지적한 "authenticated의 전체 컬럼 grant가 뷰의 컬럼 마스킹을 우회한다"는 문제가 재발하는지 검토했습니다 — 이 테이블의 컬럼(`image_path`, `caption`, `display_order`)은 전부 공개 의도 그대로라 숨길 컬럼이 없으므로 우회 위험이 없음을 확인했고, 지시서 SQL을 그대로 유지했습니다.

## 2. Storage: `profile-gallery` 버킷

`profile-images`가 쓰는 패턴(비공개 버킷 + 본인 폴더 CRUD + 공개+승인 프로필 read + admin read + anon 명시적 deny)을 그대로 복제했습니다. 다만 관리자 read 정책은 `profile-images`가 여전히 갖고 있는 죽은 `auth.jwt() app_metadata` 방식이 아니라, 이 프로젝트의 실제 관리자 판정 방식인 `is_admin(auth.uid())`으로 처음부터 작성했고, DELETE 정책도 처음부터 본인 폴더로 제한했습니다(`profile-images`/`evidence-files`는 이 제한이 나중에 별도 패치로 추가됐던 이력이 있음 — `20260728060000`).

`app/api/profile-gallery/[...path]/route.ts` 신규 — `app/api/profile-photo/[...path]/route.ts`를 그대로 복제해 버킷명만 교체.

## 3. `save_own_gallery_images` RPC

`save_own_licenses()`와 동일한 구조(SECURITY DEFINER, `SET search_path = ''`, draft/rejected/approved 게이트, 본인 폴더 경로 검증, DELETE 전체 후 INSERT 전체)로 작성했고, 배열 길이 10 초과 시 즉시 `{ok:false, error:'이미지는 최대 10장까지 등록할 수 있습니다'}`를 반환합니다. **이 테이블에는 `demote_profile_if_approved_trigger`를 붙이지 않았습니다** — 4절에서 이를 실측으로 확인했습니다.

## 4. 데모트 트리거 미적용 — 실측 확인 (이번 검증의 핵심)

로컬 테스트 계정(승인된 프로필)으로 실측했습니다:

1. `/expert/edit?section=gallery`에서 이미지 3장 업로드 → 캡션 입력 → 순서 변경(위/아래 버튼) → 1장 삭제 → 저장.
2. 저장 직후 화면에 "✓ 저장되었습니다. 바로 공개 프로필에 반영됩니다."(지시서가 준 다른 섹션 공용 문구 "재검토 대기열로 이동했습니다"를 그대로 재사용하면 갤러리 저장 시 사실과 다른 안내가 되므로, 갤러리 전용 문구로 분리했습니다 — 5절 참고).
3. DB 직접 조회: `profiles.verification_status='approved'`, `is_public=true` — **저장 전후 변화 없음**.
4. `profile_gallery_images`에 2행이 `display_order=0,1`로 정상 저장되고 캡션도 올바른 위치에 붙어 있음을 확인.

## 5. `EditForm`/`AccountSidebar` — 갤러리 저장 문구 분리 (지시서 밖 수정)

`app/expert/edit/EditForm.tsx`는 experience/education/certification/workplace/specialty 5개 섹션이 공유하는 `SECTION_SUBMIT_LABEL`("저장 후 재검토 요청")/`SECTION_SAVED_MESSAGE`("저장되었습니다. 재검토 대기열로 이동했습니다.")를 그대로 갤러리에도 물리면, 데모트 트리거가 없는 갤러리 저장에 대해 **사실과 다른 안내**(재검토 대기열로 이동한다고 말하지만 실제로는 즉시 공개 유지)가 나갑니다. 이를 막기 위해 `GALLERY_SUBMIT_LABEL`("저장")/`GALLERY_SAVED_MESSAGE`("✓ 저장되었습니다. 바로 공개 프로필에 반영됩니다.")를 별도로 두고 갤러리 섹션에만 적용했습니다.

`EDIT_SECTIONS`(EditForm.tsx)와 `EDIT_SECTION_LINKS`(AccountSidebar.tsx) 양쪽에 `{ value: 'gallery', label: '갤러리' }`를 지시서 지침대로 각각 하드코딩 추가했습니다(공용 상수 리팩터링은 범위 밖).

## 6. 발견한 실제 결함: `service_role` 기본 권한 누락 (지시서 밖, 실측 중 발견)

로컬 검증 중 서비스 역할로 비공개 프로필 픽스처를 직접 삽입하려다 `permission denied for table profile_gallery_images (42501)`을 만났습니다. 조사 결과, 이 프로젝트에서 원본 baseline 덤프로 만들어진 기존 테이블(`licenses`, `profiles` 등)과 달리, **마이그레이션으로 새로 `CREATE TABLE`한 테이블은 `service_role`의 기본 INSERT/SELECT/UPDATE/DELETE 권한을 자동으로 받지 않습니다**(`TRUNCATE`/`REFERENCES`/`TRIGGER`만 기본으로 붙음). `anon`에 대한 `ALTER DEFAULT PRIVILEGES` 회수 규칙(`20260728010000_m4_followup_anon_grant_cleanup.sql`)은 있지만, `service_role`에 대한 자동 부여 규칙 자체가 애초에 없다는 뜻입니다.

실제 배포된 앱 코드는 이 테이블에 항상 `save_own_gallery_images()` SECURITY DEFINER RPC(함수 소유자 권한으로 실행, `service_role`이 아님)를 통해서만 쓰기 때문에 이 갭이 지금 당장 기능을 깨지는 않지만, 향후 서비스롤 기반 스크립트/cron/edge function이 이 테이블을 직접 건드리면 조용히 막힐 것이므로 마이그레이션에 다음을 추가했습니다:

```sql
GRANT ALL ON public.profile_gallery_images TO service_role;
```

## 7. 공개 프로필 노출 + 검증

`app/experts/[id]/page.tsx`가 `public_expert_detail` 뷰는 건드리지 않고 `profile_gallery_images`를 별도 쿼리로 가져와(`anon_select_public`/`authenticated_select_public` RLS로 이미 안전), "소개"와 "경력" 섹션 사이에 `GalleryCarousel`(캐러셀, `h2: "사진"`) → `GalleryFullScroll`(풀 갤러리, `h2: "상세 이미지"`)순으로 배치했습니다. 캐러셀을 미리보기로 먼저 보여주고 그 아래 상세 버전을 두는 지시서의 권장 배치를 그대로 따랐습니다. 두 컴포넌트 모두 이미지 0장이면 `null`을 반환해 렌더링되지 않습니다.

**실측**:
- 이미지 2장 저장된 승인 프로필의 `/experts/[id]`에서 "사진"(캐러셀)과 "상세 이미지"(풀 갤러리) 두 섹션이 모두 렌더링되고 캡션이 풀 갤러리 쪽에만 표시됨을 확인.
- `/api/profile-gallery/{path}` 직접 호출 시 `200 image/png`로 실제 이미지 바이트가 반환됨을 확인.
- **anon 세션**으로 같은 URL 호출 시 `200`(공개+승인 프로필), 별도로 만든 비공개(pending) 프로필의 이미지 URL 호출 시 `404`를 확인 — 기존 `profile-images`와 동일한 보호 수준.
- **인증된 비소유자** 세션(다른 로그인 사용자)으로도 비공개 프로필의 이미지에 `404`를 확인.

## 8. 11장 제한 — 실측

- **클라이언트**: 이미 2장 있는 상태에서 9장을 한 번에 선택 → "이미지는 최대 10장까지 등록할 수 있습니다" 에러로 즉시 거부, 카운터는 2/10 그대로.
- **서버(RPC)**: 클라이언트를 완전히 우회해 실제 로그인 세션으로 `save_own_gallery_images`에 11개짜리 배열을 직접 호출 → `{ok:false, error:'이미지는 최대 10장까지 등록할 수 있습니다'}` 반환, DB의 기존 2장은 그대로 유지(DELETE 이전에 거부되므로 데이터 손실 없음).

## 9. 회원탈퇴 유예기간 정리 — `purge-deleted-accounts` 확장

`app/api/cron/purge-deleted-accounts/route.ts`에 `profile-images`/`evidence-files`와 동일한 패턴으로 `profile-gallery` 버킷 정리 블록을 추가했습니다. evidence-files와 달리 갤러리 이미지는 "의도적 영구보관" 대상이 아닌 일반 자산이므로 삭제 대상이 맞다는 지시서 판단을 그대로 반영했습니다.

**실측**: `deletion_requested_at`을 유예기간(14일) 이전으로 설정한 테스트 계정에 대해, 라우트가 추가한 것과 동일한 list+remove 로직을 서비스 역할로 직접 실행 → 정리 전 1개 파일 확인 → 실행 후 해당 사용자 폴더가 빈 목록으로 확인됨. (로컬 dev 서버에 `CRON_SECRET`/`SUPABASE_SERVICE_ROLE_KEY` 환경변수가 설정되어 있지 않아 라우트 자체를 HTTP로 직접 호출하지는 않았습니다 — 이는 이번 작업 범위 밖의 기존 로컬 환경 설정 문제이며, 동일 Storage 오퍼레이션을 서비스 역할로 직접 실행해 로직 자체의 정확성을 검증했습니다.)

## 10. 로컬 검증

- `supabase db advisors --local --type security --level error --fail-on none` → 이슈 없음.
- `pnpm test` → **53/53 PASS**.
- `tsc --noEmit` → 클린.
- `pnpm build` → 성공(`/api/profile-gallery/[...path]` 라우트 포함 12개 페이지 정상 생성).
- 테스트 계정(`gallery-check-expert@example.com`, `gallery-private-expert@example.com`) 및 관련 데이터/Storage 파일 정리 완료.

## 11. 프로덕션 미적용 — 확인 요청

PR #45/#46과 동일하게, 이번 라운드 작업 계획에 "프로덕션 적용" 단계가 명시되지 않아 로컬 검증까지만 진행했습니다. 신규 테이블/버킷/RPC를 프로덕션에 적용할지, PR을 병합할지는 별도로 확인 부탁드립니다.

## 12. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `supabase/migrations/20260731000000_profile_gallery.sql` | 신규 — 테이블/RLS/GRANT, `profile-gallery` 버킷+Storage RLS, `save_own_gallery_images()` RPC |
| `app/api/profile-gallery/[...path]/route.ts` | 신규 — 프록시 라우트 |
| `lib/storage/gallery-image-url.ts` | 신규 |
| `app/actions/gallery.ts` | 신규 — `getOwnGalleryImages()`, `saveGalleryImages()` |
| `components/profile-sections/GallerySection.tsx` | 신규 — 편집 화면 컴포넌트 |
| `components/GalleryCarousel.tsx` | 신규 — 공개 프로필 캐러셀 |
| `components/GalleryFullScroll.tsx` | 신규 — 공개 프로필 풀 갤러리 |
| `app/expert/edit/EditForm.tsx` | `gallery` 섹션 추가, 갤러리 전용 저장 문구 분리 |
| `components/AccountSidebar.tsx` | `EDIT_SECTION_LINKS`에 `gallery` 추가 |
| `app/experts/[id]/page.tsx` | 갤러리 쿼리 + 두 컴포넌트 배치 |
| `app/api/cron/purge-deleted-accounts/route.ts` | `profile-gallery` 버킷 정리 블록 추가 |
