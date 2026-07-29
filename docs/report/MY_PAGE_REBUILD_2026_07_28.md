# /my 페이지 재구축 보고서

**작성일**: 2026-07-28
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: `app/my/page.tsx` 화면 재작성만 진행. 기존 서버 액션/RPC/RLS/state-gate 로직은 전혀 변경하지 않음(지시서 2절 그대로). 회원 탈퇴, 프로필 완성도 게이지는 범위 밖.

---

## 0. 사전 확인

- 백엔드는 이미 준비돼 있었음을 확인: `getOwnProfile`, `getOwnWorkplace`, `getOwnExperiences`, `getOwnCertifications`, `getOwnSelectedSpecialtyIds`/`getSpecialties`, `get_own_rejection_reason()` RPC 전부 기존에 존재. 화면만 연결하면 되는 상태였고, 실제로 새 서버 액션/RPC는 하나도 추가하지 않았습니다.
- 기존 `/my`는 draft/pending/rejected 3개 상태는 (M1 placeholder치고는) 이미 부분적으로 분기하고 있었으나, **"프로필 없음" 상태는 전혀 처리 안 됨**(그냥 이메일/ID/상태 블록만 노출)과 **"approved" 상태가 아예 없음**(어떤 분기도 안 걸림, 빈 화면)이 확인됐습니다. "M1 Note" placeholder 문구도 그대로 남아있었습니다.

---

## 1. 화면 재구축

`app/my/page.tsx`를 5가지 상태로 재작성했습니다:

| 상태 | 내용 |
|---|---|
| 프로필 없음 | "전문가 프로필 만들기" CTA → `/expert/onboarding` |
| `draft` | 입력한 내용 요약(이름/직군/한줄소개/근무기관/전문분야/경력·자격 건수) + "이어서 작성하기" |
| `pending` | "현재 관리자 검토 중입니다" 안내 + 동일 요약(읽기 전용, 수정 버튼 없음) |
| `approved` | "공개 중" 표시 + `/experts/[id]` 공개 프로필 링크 + 요약 + 아래 3절 참고 |
| `rejected` | `get_own_rejection_reason()` 반려 사유 노출 + 요약 + "수정하고 다시 제출하기" |

로그아웃 버튼은 그대로 유지했고, "M1 Note" 문구와 이메일/ID/"상태: 인증됨" 형태의 placeholder 블록은 완전히 제거했습니다(이메일만 헤더에 남김).

## 2. approved 상태에서 "수정하기"의 실제 동작 (지시서가 명시적으로 요구한 조사)

`save_own_profile()` RPC의 실제 정의를 직접 확인했습니다:

```sql
IF v_profile_id IS NOT NULL AND v_status NOT IN ('draft', 'rejected') THEN
  RETURN QUERY SELECT FALSE, 'Profile status does not allow editing'::TEXT;
  RETURN;
END IF;
```

**결론**: approved 상태에서 저장을 시도하면 "재검토 대기 상태로 바뀌는" 것이 아니라, **저장 자체가 완전히 차단**됩니다(하드 블록). 프로필은 그대로 approved/공개 상태로 남고, 아무 것도 바뀌지 않습니다. 이 로직은 이번 지시서 범위(2절)에 따라 전혀 건드리지 않았습니다.

**추가로 확인한 사실(더 중요함)**: 실제로 승인된 테스트 계정으로 `/expert/onboarding/profile`에 들어가 저장을 시도해본 결과, 화면에는 `save_own_profile`이 반환한 `'Profile status does not allow editing'` 원문조차 노출되지 않고 **"⚠️ 입력 오류가 있습니다. 아래 항목을 확인해주세요."라는 일반 배너만** 뜹니다(어떤 필드가 문제인지, 왜 안 되는지 전혀 설명 없음). 즉 이 상황을 사전에 안내하지 않으면 사용자는 원인을 전혀 알 수 없습니다.

**조치**: `/my`의 approved 카드에 아래 안내문을 미리 노출합니다.

> 승인되어 공개 중인 프로필은 현재 온보딩 화면에서 저장할 수 없습니다. 온보딩 화면에서 내용을 바꾸고 저장을 시도하면 "수정할 수 없는 상태" 오류가 표시됩니다. 정보를 변경하고 싶다면 관리자에게 문의해주세요.

버튼 라벨도 "수정하기"가 아니라 "입력했던 내용 확인하기"로 표기해 오해의 소지를 줄였습니다. (온보딩 화면 자체의 에러 메시지를 한국어로 매핑하는 작업은 `app/expert/onboarding/profile/page.tsx` 등 다른 파일을 건드려야 해서 이번 지시서의 "화면만, `/my`" 범위 밖으로 남겨뒀습니다 — 별도 지시서 대상으로 스팟 발견 사항입니다.)

---

## 3. 검증

로컬 Supabase에 5가지 상태 각각을 실제 테스트 계정으로 재현하고, 로그인해서 `/my`를 직접 열어 확인했습니다(테스트 후 계정/데이터 즉시 삭제):

| 상태 | 실측 결과 |
|---|---|
| 프로필 없음 | "아직 전문가 프로필이 없습니다" + "전문가 프로필 만들기" 버튼만 노출. M1 문구 없음 |
| draft | "작성 중" + 요약(이름·직군·한줄소개·근무기관·경력/자격 0건) + "이어서 작성하기" |
| pending | "현재 관리자 검토 중입니다..." + 요약(경력 1건) — 수정 버튼 없음 확인 |
| approved | "공개 중" + 요약(근무기관/전문분야/경력 1건/자격 1건) + "공개 프로필 보기"(`/experts/<id>`, 실제 클릭해 정상 로드 확인) + 위 2절 안내문 + "입력했던 내용 확인하기" |
| rejected | "반려됨" + "반려 사유: 프로필 사진이 흐릿하여 재업로드가 필요합니다." (실제 `admin_actions` 픽스처로 주입 후 `get_own_rejection_reason()`으로 정상 조회) + "수정하고 다시 제출하기" |

approved 상태에서 실제로 `/expert/onboarding/profile`까지 들어가 "다음" 버튼을 눌러 저장을 시도해, 위 2절에서 서술한 "일반 오류 배너만 뜨고 원인 불명"이라는 실제 동작을 직접 재현·확인했습니다.

## 4. 회귀 확인

| 항목 | 결과 |
|---|---|
| 전체 테스트 스위트 (`jest`) | ✅ 44/44 통과 (변경 없음) |
| `npm run check` (`tsc --noEmit`) | ✅ 에러 없음 |
| `npm run build` | ✅ 성공 |

이번 작업은 프로덕션 DB/RPC/RLS에 전혀 영향이 없습니다(화면 파일 1개만 변경 — `app/my/page.tsx`).

---

## 5. 완료 기준 체크

- [x] `/my`가 프로필 상태(없음/draft/pending/approved/rejected) 5가지에 맞게 다른 화면을 보여줌
- [x] approved 상태에서 공개 프로필 링크 확인 가능
- [x] rejected 상태에서 반려 사유 확인 가능
- [x] M1 placeholder 문구 완전 제거
- [x] 기존 테스트/빌드 회귀 없음
