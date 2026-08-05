-- 전문가 찾기 검색창: search_public_experts()에 이름/한 줄 소개 텍스트 검색
-- 파라미터(p_query) 추가.
--
-- 시그니처가 바뀌므로 CREATE OR REPLACE가 아니라 DROP 후 재생성한다 --
-- CREATE OR REPLACE는 파라미터가 다르면 기존 함수를 대체하지 않고 오버로드를
-- 새로 만들어, p_query 없이 호출할 때 5-파라미터/6-파라미터(기본값) 중 어느
-- 쪽인지 PostgREST가 결정하지 못하는 모호성 에러가 생긴다.
DROP FUNCTION public.search_public_experts(text, text, text, integer, integer);

CREATE FUNCTION public.search_public_experts(
  p_profession text DEFAULT NULL::text,
  p_region text DEFAULT NULL::text,
  p_specialty_slug text DEFAULT NULL::text,
  p_query text DEFAULT NULL::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
 RETURNS SETOF public_expert_list
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.public_expert_list l
  WHERE (
      p_profession IS NULL
      OR l.professions @> jsonb_build_array(jsonb_build_object('slug', p_profession))
    )
    AND (p_region IS NULL OR l.workplace_region = p_region)
    AND (
      p_specialty_slug IS NULL
      OR l.specialties @> jsonb_build_array(jsonb_build_object('slug', p_specialty_slug))
    )
    -- 이름/한 줄 소개 대소문자 무시 부분일치. 현재 데이터 규모(수 건)에서는
    -- ILIKE 전체 스캔으로 충분하다 -- 프로필이 수천 건 규모로 늘어나면
    -- pg_trgm GIN 인덱스 도입을 고려할 것.
    AND (
      p_query IS NULL OR trim(p_query) = ''
      OR l.display_name ILIKE '%' || p_query || '%'
      OR l.headline ILIKE '%' || p_query || '%'
    )
  ORDER BY l.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;
