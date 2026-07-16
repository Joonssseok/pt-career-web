# PT Career Design System v1.0

## 1. Design Principles

- 모바일 우선
- 명함처럼 빠르게 읽힘
- 신뢰감 있는 색상
- 과도한 장식 금지
- 기능보다 정보 위계 우선

## 2. Color

### Primary
- Deep Navy: `#0F172A`
- Blue: `#2563EB`

### Secondary
- Light Blue: `#EFF6FF`
- Slate: `#64748B`
- Border: `#E2E8F0`
- Background: `#F8FAFC`
- White: `#FFFFFF`

## 3. Typography

권장:
- Pretendard
- Inter
- 시스템 폰트 fallback

사용 원칙:
- 제목은 명확하게
- 본문은 14~16px
- 모바일 카드 내 텍스트는 2~3줄 이내

## 4. Components

### Expert Card
필수 정보:
- 프로필 사진
- 이름
- 직군
- 경력
- 대표 전문 분야 2~3개
- 센터명
- 지역
- 자격 확인 상태

카드에는 긴 자기소개를 넣지 않는다.

### Expert Profile Header
필수 정보:
- 사진
- 이름
- 직군
- 한 줄 소개
- 전문 분야
- 경력
- 근무기관
- 지역
- 공유 버튼
- 전화/지도/홈페이지 버튼

### Badge
예시:
- 자격 확인
- 검토 대기
- 신규 등록
- 물리치료사
- 트레이너
- 스포츠재활
- 도수치료

### Button
Primary:
- 전문가 찾기
- 프로필 공유
- 전문가 등록

Secondary:
- 지도 보기
- 전체 전문가
- 링크 복사

Danger:
- 회원 탈퇴
- 프로필 비공개

## 5. Layout

### Mobile
- 하단 고정 주요 액션 허용
- 지도/목록은 탭 전환
- 프로필 상단에서 공유 버튼이 보여야 함

### Desktop
- 지도 + 목록 분할 가능
- 카드 그리드
- 상세 프로필은 2-column 가능

## 6. Empty State

검색 결과 없음:
“조건에 맞는 전문가를 찾지 못했어요. 지역이나 전문 분야를 다시 선택해보세요.”

프로필 미완성:
“프로필을 공개하려면 필수 정보를 입력해주세요.”

## 7. Loading/Error

- Skeleton UI 우선
- 에러 메시지는 사용자가 이해할 수 있는 문장으로 표시
- 개발자용 에러를 사용자에게 노출하지 않음
