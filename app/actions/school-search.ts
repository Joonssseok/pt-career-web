'use server';

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
      return [];
    }

    const json = await res.json();
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
