# 자격 증빙 파일 업로드 UI 완료 보고

**Status**: 구현 완료 + 실제 계정 종단 검증 완료 (mock 없음). 프로덕션 적용 완료.
**Date**: 2026-07-28
**Authority**: Claude Code (M7 착수 전 현황 점검에서 확인된 미완성 Must 기능 — 자격 증빙 파일 업로드 UI 지시서 실행)

---

## 1. 업로드 UI

- `app/expert/onboarding/education/page.tsx`(자격증 입력 단계)에 자격증 항목별 증빙 파일 업로드 필드 추가(jpg/png/pdf, 10MB 이하, 선택사항).
- 경로 설계: `evidence-files/{user.id}/{crypto.randomUUID()}.{ext}` — license의 DB 행 id가 아니라 클라이언트에서 생성한 임의 UUID를 파일명으로 사용. `saveCertifications`가 매 저장마다 licenses를 통째로 delete-then-reinsert하는 방식이라(license id가 매번 바뀜), 경로를 license id에 묶으면 재저장할 때마다 경로가 깨진다 — 임의 UUID는 이 재삽입과 무관하므로 안전.
- 파일 선택 즉시 클라이언트에서 `evidence-files` 버킷에 직접 업로드(기존 프로필 사진 업로드와 동일한 패턴), 성공 시 경로를 폼 상태에 저장, "추가된 자격증" 목록에 "📎 증빙 파일 보기" 링크로 표시.
- `document_path_private`를 `getOwnCertifications`/`saveCertifications`(`app/actions/certification.ts`)에 연결 — 조회 시 하이드레이션, 저장 시 insert에 반영.

## 2. 파일 조회 프록시

- `app/api/evidence-file/[...path]/route.ts` 신설 — `/api/profile-photo/[...path]`와 동일한 패턴(`supabase.storage.from('evidence-files').download(path)`, 실제 `Content-Type` 그대로 스트리밍). PDF도 `Content-Type: application/pdf`로 응답해 브라우저가 알아서 새 탭/뷰어로 처리.
- `lib/storage/evidence-file-url.ts`에 `getEvidenceFileUrl()` 헬퍼 추가(`getProfilePhotoUrl`과 동일 패턴).

## 3. 관리자 검토 화면 연결 + 새 정책

- `supabase/migrations/20260728100000_admin_select_any_evidence_file.sql` — `is_admin()` 기반 `admin_select_any_evidence_file` SELECT 정책을 `evidence-files`에 신설(`profile-images`의 `admin_select_any_profile_image`와 동일 패턴). 기존 죽은 `admin_select_evidence_files`(jwt 기반)는 지시대로 그대로 둠.
- `app/admin/[id]/page.tsx`: 하드코딩된 "증빙 파일: 없음 (업로드 기능 미구현)" 섹션 제거, 대신 "자격증" 목록의 각 항목에 `document_path_private` 유무에 따라 실제 링크(있으면) 또는 "증빙 파일 없음"(없으면)을 표시하도록 변경 — 자격증 여러 개가 각자 다른 증빙을 가질 수 있는 데이터 모델과 더 맞는 구조라 별도 섹션 대신 항목별로 통합.

## 4. 검증 (mock 없음, 실제 프로덕션 계정)

**로컬(Supabase 로컬, 실제 계정 3인 — owner/other/admin)**: 오너 업로드 → licenses insert(document_path_private 포함) → 하이드레이션 재조회 → 오너 본인 다운로드(200) → 관리자 다운로드(`admin_select_any_evidence_file`로 200) → 타인(other) 다운로드 시도(404, RLS 차단) — 7단계 전부 스크립트로 실제 확인.

**프로덕션(실제 브라우저, 실제 계정 3인)**:
1. 오너 계정으로 로그인 → 프로필 저장 → 자격증 입력 단계에서 실제 PDF 파일을 `DataTransfer`로 파일 입력에 첨부(진짜 File 객체 + 진짜 `change` 이벤트 — 실제 업로드 코드 경로 그대로 실행)해 실제 `evidence-files` 버킷에 업로드 → "✓ 업로드 완료" 확인 → 자격증 추가 → 저장 → 전문분야 단계로 정상 이동 확인.
2. 자격증 입력 단계 재진입 → 방금 업로드한 파일이 "📎 증빙 파일 보기" 링크로 그대로 유지됨을 확인(이전 온보딩 하이드레이션 수정과 연결되는 부분, 정상 작동).
3. 실제로 그 링크를 fetch — `200 / application/pdf / 업로드했던 실제 바이트 내용 그대로` 확인.
4. 관리자 계정으로 로그인 → `/admin/{profile_id}`(해당 프로필은 draft 상태 — `/admin/[id]`는 상태 무관하게 id로 직접 조회하므로 접근 가능) → "📎 증빙 파일 보기" 링크가 실제로 렌더링됨을 확인 → 그 링크를 fetch — `200 / application/pdf`, 업로드된 실제 내용 그대로 수신 확인(새로 추가한 `admin_select_any_evidence_file` 정책이 실제로 프로덕션에서 작동함을 증명).
5. 제3의 계정(other, 오너도 관리자도 아님)으로 로그인 → 오너의 증빙 파일 URL에 직접 fetch — 최초 시도는 브라우저 로컬 HTTP 캐시(같은 탭에서 오너 세션일 때 같은 URL을 이미 fetch했던 잔재 — 브라우저 캐시는 쿠키/세션을 캐시 키로 쓰지 않는 특성 때문. `/api/profile-photo`도 동일한 `Cache-Control: private` 패턴을 이미 쓰고 있어 이번에 새로 생긴 특성은 아님)로 인해 200이 나왔으나, `cache: 'no-store'`로 캐시를 무력화해 재요청하니 **정확히 404로 차단**됨을 확인 — RLS가 실제로 타인 접근을 막고 있음을 재확인.
6. 검증에 사용한 계정 3개, 프로필, 업로드했던 실제 스토리지 오브젝트까지 전부 삭제, 잔존 데이터 없음 확인.

## 5. 회귀 확인

- `pnpm test`(로컬 Supabase): 43/43 통과
- `tsc --noEmit`: 통과
- `pnpm build`: 성공 (`/api/evidence-file/[...path]` 라우트 정상 빌드 확인)

## 프로덕션 적용

기존 절차(백업 → `migration list --linked` 드리프트 확인 → `db push --linked` → 직접 재조회) 그대로 진행. 백업: `backup_pre_evidence_file_upload_20260728.sql`(스키마), `_data.sql`(데이터). 적용 후 `pg_policies` 직접 재조회로 `admin_select_any_evidence_file` 정책이 정확한 조건(`bucket_id = 'evidence-files' AND is_admin(auth.uid())`)으로 생성됐음을 확인.

## 범위 밖 (지시대로 손대지 않음)

- 자격증 개별 승인/반려 워크플로우 — 다음 지시서 대상
- 죽은 `admin_select_evidence_files`(jwt 기반) 정책 삭제 여부 — 이번에도 보류
- 자격증 삭제/재저장 시 이전에 업로드했던(더 이상 참조되지 않는) storage 오브젝트 정리 — 프로필 사진 업로드와 동일하게 이미 있던 특성이라 이번 범위에서 추가 정리 로직을 넣지 않음(별도 결정 필요 시 요청 부탁)

## 완료 기준 충족 확인

- ✅ 자격증 등록 시 증빙 파일(PDF 실제 테스트) 업로드 가능, 재진입해도 값 유지됨
- ✅ 관리자가 `/admin/[id]`에서 실제로 증빙 파일을 열어볼 수 있음
- ✅ 본인 아닌 사용자는 다른 사람의 증빙 파일에 접근 불가(캐시 우회 후 RLS로 실제 확인)
- ✅ 기존 테스트/빌드 회귀 없음
