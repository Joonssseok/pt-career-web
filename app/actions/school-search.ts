'use server';

import universities from '@/lib/data/korean-universities.json';

// 나이스(NEIS) 교육정보 개방 포털 학교기본정보 Open API 연동.
// https://open.neis.go.kr/hub/schoolInfo -- KEY/Type/pIndex/pSize + SCHUL_NM(학교명)
// 검색 파라미터를 받고, 응답은 schoolInfo[0]=head(RESULT), schoolInfo[1]=row(배열) 형태.
//
// NEIS_API_KEY 환경변수는 아직 발급 전이라 지금은 비어 있다. 키가 없거나,
// 네트워크/파싱 어느 단계에서 실패하더라도 항상 빈 배열을 돌려주고 절대
// 에러를 던지지 않는다 -- 호출부(AcademicSection)는 빈 배열을 "검색 결과
// 없음"으로 취급해 자유 텍스트 입력으로 조용히 폴백한다. 키가 나중에
// Vercel 환경변수로 추가되는 순간, 코드 변경/재배포 없이 자동완성이 켜진다.
const NEIS_SCHOOL_INFO_URL = 'https://open.neis.go.kr/hub/schoolInfo';

export type SchoolSearchResult = {
  code: string;
  name: string;
  address: string;
};

export async function searchSchools(query: string): Promise<SchoolSearchResult[]> {
  const apiKey = process.env.NEIS_API_KEY;
  const trimmed = query.trim();

  if (!apiKey || trimmed.length < 2) {
    return [];
  }

  try {
    const url = new URL(NEIS_SCHOOL_INFO_URL);
    url.searchParams.set('KEY', apiKey);
    url.searchParams.set('Type', 'json');
    url.searchParams.set('pIndex', '1');
    url.searchParams.set('pSize', '20');
    url.searchParams.set('SCHUL_NM', trimmed);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      console.error('[searchSchools] NEIS API HTTP error, status:', res.status);
      return [];
    }

    const json = await res.json();

    // NEIS는 인증키 오류 등 전역 실패 시 { RESULT: { CODE, MESSAGE } } 형태로,
    // 성공/정상 응답 시에도 schoolInfo[0].head 안에 RESULT를 담아 보낸다. 두
    // 위치 모두 확인해 실패 시 코드/메시지를 로그로만 남긴다(키 값 자체는
    // 절대 로그하지 않음) -- 클라이언트에는 여전히 빈 배열만 돌려준다.
    const topLevelResult = json?.RESULT;
    const headResult = json?.schoolInfo?.[0]?.head?.find(
      (h: Record<string, unknown>) => h?.RESULT
    )?.RESULT;
    const result = topLevelResult ?? headResult;
    if (result && result.CODE !== 'INFO-000') {
      console.error('[searchSchools] NEIS API non-success RESULT:', result.CODE, result.MESSAGE);
    }

    const rows = json?.schoolInfo?.[1]?.row;
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((row: Record<string, string>) => ({
      code: row.SD_SCHUL_CODE ?? '',
      name: row.SCHUL_NM ?? '',
      address: row.ORG_RDNMA ?? '',
    }));
  } catch (err) {
    console.error('[searchSchools] threw:', err);
    return [];
  }
}

// 대학교/대학원용 학교명 자동완성 -- NEIS "학교기본정보" 데이터셋은 초중등
// 전용이라 대학교/대학원을 아예 다루지 않는다(별도 진단 완료). 대신 공공데이터
// 포털 "전국대학및전문대학정보표준데이터"(data.go.kr, 데이터셋 15107736)에서
// 대학구분명="대학"인 행(대학교/사이버대학/교육대학/산업대학/각종학교/기술대학
// 등, 전문대학·대학원 프로그램 행은 제외)만 추려 정적 JSON으로 미리 번들링해
// 둔 것을 메모리에서 필터링한다 -- 외부 네트워크 호출이 없으므로 키 발급/
// 활용신청 대기, 파라미터 불일치 같은 NEIS에서 겪은 실패 지점 자체가 없다.
// 대학원 레벨도 이 동일한 대학교 목록을 그대로 사용한다(소속 대학교명으로
// 검색 -- 세부 대학원 프로그램명이 아님, 지시서 5-a 판단).
//
// 갱신 방법(연 1회 정도): data.go.kr/data/15107736/standard.do 접속 →
// "한국대학교육협의회_대학및전문대학정보" 상세보기 → 그리드 탭 → CSV
// 다운로드 → 대학구분명="대학"인 행만 추려 학교명/학교구분명/시도명/주소만
// 남겨 lib/data/korean-universities.json으로 저장(스키마는 UniversityRecord
// 참고). 2026-07-31 기준 262건.
type UniversityRecord = {
  name: string;
  type: string;
  region: string;
  address: string;
  branch: string;
};

const UNIVERSITIES = universities as UniversityRecord[];

export async function searchUniversities(query: string): Promise<SchoolSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  try {
    const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const needle = normalize(trimmed);

    return UNIVERSITIES.filter((u) => normalize(u.name).includes(needle))
      .slice(0, 20)
      .map((u, idx) => ({
        code: String(idx),
        name: u.name,
        address: u.address,
      }));
  } catch (err) {
    console.error('[searchUniversities] threw:', err);
    return [];
  }
}
