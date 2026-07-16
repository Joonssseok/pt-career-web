# PT Career Database Design v1.0

## 1. 설계 원칙

- 사용자 계정과 공개 전문가 프로필을 분리한다.
- 자격번호와 증빙파일은 일반 사용자에게 공개하지 않는다.
- 프로필은 공개/비공개 상태를 가진다.
- 지도 검색을 위해 근무기관에는 위도/경도를 저장한다.
- 향후 앱, 교육, 채용으로 확장 가능하게 구성한다.

## 2. Core Tables

### users
Supabase Auth를 기본 사용한다.

### profiles
전문가 공개 프로필

Fields:
- id
- user_id
- display_name
- profile_image_url
- profession
- headline
- introduction
- total_experience_years
- region
- is_public
- verification_status
- slug
- created_at
- updated_at

### workplaces
근무기관

Fields:
- id
- profile_id
- center_name
- address
- address_detail
- latitude
- longitude
- phone
- website_url
- external_contact_url
- is_current
- created_at
- updated_at

### licenses
면허/자격

Fields:
- id
- profile_id
- license_name
- issuing_organization
- acquired_date
- license_number_encrypted
- document_url_private
- verification_status
- is_public
- created_at
- updated_at

### experiences
경력

Fields:
- id
- profile_id
- organization_name
- position
- start_date
- end_date
- description
- display_order

### educations
교육 이력

Fields:
- id
- profile_id
- education_name
- organization_name
- completion_date
- description
- display_order

### specialties
전문 분야 마스터

Fields:
- id
- name
- category

### profile_specialties
프로필-전문분야 연결

Fields:
- profile_id
- specialty_id

### share_events
프로필 공유 이벤트

Fields:
- id
- profile_id
- share_type
- referrer
- created_at

### contact_click_events
문의 버튼 클릭 이벤트

Fields:
- id
- profile_id
- click_type
- created_at

### reports
신고

Fields:
- id
- reporter_user_id
- profile_id
- reason
- description
- status
- created_at

### admin_actions
관리자 조치 로그

Fields:
- id
- admin_user_id
- target_profile_id
- action_type
- memo
- created_at

## 3. Verification Status

- not_submitted
- pending
- verified
- rejected

관리자가 확인하지 않은 정보에는 “검증 완료” 표시를 하지 않는다.

## 4. RLS 원칙

- 사용자는 자신의 프로필만 수정할 수 있다.
- 공개 프로필만 일반 사용자에게 노출한다.
- 비공개 프로필은 본인과 관리자만 볼 수 있다.
- 자격 증빙파일은 private bucket에 저장한다.
- 관리자 권한은 DB 기반으로 검증한다.
- service_role key는 클라이언트에 노출하지 않는다.
