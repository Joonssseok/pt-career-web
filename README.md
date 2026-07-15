# PT Career Web

**내 주변 재활·운동 전문가 찾기** — Next.js + TypeScript + Supabase + Vercel

## 프로젝트 정보

- **저장소:** https://github.com/Joonssseok/pt-career-web
- **상태:** Phase New-0 (Repository creation)
- **대상:** MVP 출시용 clean baseline

## 기술 스택

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript 5.x
- **Styling:** Tailwind CSS 4.x
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Deployment:** Vercel
- **Package Manager:** pnpm

## 프로젝트 구조

```
pt-career-web/
├── docs/
│   ├── 10_DECISION_LOG.md
│   ├── 13_UX_FLOW.md
│   ├── CHANGELOG.md
│   └── README.md (이 파일)
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
├── lib/
├── types/
├── public/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
└── .gitignore
```

## 시작하기

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 빌드 검증
pnpm build

# TypeScript 체크
npx tsc --noEmit
```

## 배포

Vercel에 자동으로 배포됩니다:
1. GitHub의 main 브랜치에 push
2. Vercel이 자동으로 빌드 및 배포
3. Preview URL 생성

## 주의사항

### 절대 추가하지 말 것
- ❌ Express 서버 코드
- ❌ Manus OAuth 로직
- ❌ Render 배포 설정
- ❌ Vite 빌드 파일
- ❌ 기존 Drizzle schema

### 이미 제외된 것
- `/node_modules`
- `/.next`
- `/dist`
- `.env` 파일들

## 이전 저장소

**기존 저장소:** https://github.com/Joonssseok/pt-career  
- 상태: 보존 (아카이브)
- 용도: 레거시 코드 참고용 (새 기능 개발에 사용하지 않음)

## 진행 상황

- [x] Phase New-0: 저장소 생성 + 문서 이관
- [ ] Phase New-1: Next.js 클린 베이스라인
- [ ] Phase New-2: Vercel 배포 검증
- [ ] Phase 2+: Supabase 통합 (TBD)

---

**Created:** 2026-07-16  
**Target:** MVP baseline for PT Career (physiotherapist/trainer finder)
