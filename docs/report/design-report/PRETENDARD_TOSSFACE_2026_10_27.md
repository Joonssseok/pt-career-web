# PT Career 글꼴·이모지 적용 보고

Status: 구현 및 프리뷰 빌드 검증 완료
Date: 2026-10-27 (KST)
Authority: 사용자 직접 지시 — 본 프로젝트에 반영 후 현황판 기록

## 문제와 변경
현황판에만 반영된 Pretendard·Tossface 결정을 실제 제품 서비스에 반영한다.
- app/globals.css: Pretendard 1.3.9 가변 서브셋 및 Tossface 공식 웹폰트 CSS 연결. font-sans 토큰 변경.
- app/layout.tsx: 기존 Noto Sans KR Google font 로더와 해당 html class 제거.
- 색상·글자 크기·행간·간격·모서리·레이아웃·데이터/인증 로직은 유지.

## 검증 근거
- 구현 커밋: bdfd59b6c60699278b5856fe366df3d89b1d6dbd
- PR: https://github.com/Joonssseok/pt-career-web/pull/94
- Vercel 프리뷰: dpl_FkqpsfeiZx5K2yZcRZRUjKkFNaiV / READY
- Vercel pnpm run build: Compiled successfully, 타입 검사 및 빌드 완료.
- 프리뷰 홈 HTTP 200. html에서 기존 Noto font class 제거 확인.
- 배포 CSS HTTP 200. 두 공식 CDN import와 Pretendard/Tossface font-sans 토큰 확인.
- 실기기 화면·실제 폰트 다운로드/렌더링·모바일 줄바꿈 시각 검증은 별도 미검증. 글꼴 메트릭 차이로 줄바꿈은 달라질 수 있다.
- 운영 배포는 PR 병합 후 해당 커밋의 Vercel READY를 확인하여 현황판에 기록한다.

## 작업 순서 확정
1. 본 프로젝트 코드 변경
2. 영향 범위 검토 및 빌드·타입·관련 기능 검증
3. 커밋·푸시·PR 병합·운영 배포 확인
4. 현황판에 실제 커밋·PR·배포 결과·검증 근거 기록

현황판 변경만으로 본 프로젝트 작업을 완료 처리하지 않는다. 현황판 자체의 UI 개선은 제품 변경과 별도 작업으로 기록한다.
