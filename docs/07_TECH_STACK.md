# PT Career Tech Stack

## 1. 기본 방향

비전공자 1인이 Claude Code, Manus, ChatGPT를 활용해 운영할 수 있는 관리형 서비스 중심 구조를 사용한다.

복잡한 자체 서버를 만들기보다 Next.js + Supabase + Vercel 기반으로 간결하게 운영한다.

## 2. Recommended Stack

Frontend:
- Next.js
- TypeScript
- Tailwind CSS

Backend / DB:
- Supabase
- Supabase Auth
- Supabase Storage
- Supabase Row Level Security

Hosting:
- Vercel

Map:
- Kakao Map API 또는 Naver Map API

AI Tools:
- ChatGPT: 전략, PRD, UX, 마케팅, 문서화
- Manus: UI 초안, 빠른 화면 생성
- Claude Code: 코드 리뷰, 디버깅, 리팩토링, 보안 수정

Version Control:
- GitHub

## 3. 운영 원칙

- 환경변수는 `.env.local`에 저장하고 GitHub에 올리지 않는다.
- `.env.example`에는 필요한 키 이름만 명시한다.
- API key와 service role key는 클라이언트에 노출하지 않는다.
- 모든 변경은 Git commit으로 기록한다.
- 큰 변경 전에는 백업 브랜치를 만든다.

## 4. 권장 폴더 구조

```text
app/
  page.tsx
  experts/
    page.tsx
    [id]/
      page.tsx
  map/
    page.tsx
  login/
    page.tsx
  dashboard/
    page.tsx

components/
  expert-card.tsx
  profile-header.tsx
  search-filter.tsx
  map-view.tsx
  share-button.tsx

lib/
  supabase/
  utils/
  constants/

types/
  database.ts

supabase/
  migrations/
  policies/
```

## 5. MVP 품질 기준

- `npm run build` 성공
- TypeScript 오류 없음
- 모바일 360px 화면에서 사용 가능
- 로그인 없이 공개 프로필 열람 가능
- 자격 증빙파일 비공개
- Open Graph 미리보기 적용
- 실제 작동하지 않는 버튼 제거
