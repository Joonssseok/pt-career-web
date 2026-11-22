"use server";

import { createClient } from "@/lib/supabase/server";
import { naverLocalResults, type NaverLocation } from "@/lib/naver-location";

export async function searchNaverBusinesses(
  query: string,
): Promise<
  { ok: true; locations: NaverLocation[] } | { ok: false; error: string }
> {
  if (
    typeof query !== "string" ||
    query.trim().length < 2 ||
    query.length > 100
  )
    return { ok: false, error: "업체명을 2~100자로 입력해주세요." };
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, error: "로그인 후 검색해주세요." };
    const id = process.env.NAVER_LOCAL_SEARCH_CLIENT_ID;
    const secret = process.env.NAVER_LOCAL_SEARCH_CLIENT_SECRET;
    if (!id || !secret)
      return {
        ok: false,
        error:
          "업체 검색 연결을 준비 중입니다. 주소 검색은 사용할 수 있습니다.",
      };
    if (id === secret)
      return {
        ok: false,
        error: "검색 연결의 Client ID와 Client Secret을 각각 확인해주세요.",
      };
    const url = new URL("https://naverapihub.apigw.ntruss.com/search/v1/local");
    url.searchParams.set("query", query.trim());
    url.searchParams.set("display", "5");
    url.searchParams.set("sort", "random");
    url.searchParams.set("format", "json");
    const response = await fetch(url, {
      headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      return {
        ok: false,
        error:
          "네이버 업체 검색을 불러오지 못했습니다. NAVER API HUB의 지역 검색 연결을 확인해주세요.",
      };
    return { ok: true, locations: naverLocalResults(await response.json()) };
  } catch {
    return {
      ok: false,
      error: "검색에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}
