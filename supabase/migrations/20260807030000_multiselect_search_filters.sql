-- 상세검색 직군/지역/분야를 다중선택(OR)으로 변경.
-- 시그니처가 바뀌므로(단일 text -> text[]) DROP 후 재생성
-- (이 저장소에서 반복 확인된 PostgREST 오버로드 모호성 함정).
DROP FUNCTION public.search_public_experts(text, text, text, text, integer, integer);

CREATE FUNCTION public.search_public_experts(
  p_professions text[] DEFAULT NULL::text[],
  p_regions text[] DEFAULT NULL::text[],
  p_specialty_slugs text[] DEFAULT NULL::text[],
  p_query text DEFAULT NULL::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
 RETURNS SETOF public_expert_list
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- NULL = 필터 없음(전체), 빈 배열({})은 ANY(...)가 항상 false를 반환하므로
  -- "아무것도 매칭 안 함"으로 자연히 구분된다 -- 프런트는 0개 선택 시
  -- 파라미터 자체를 NULL로 보내 "전체"를 표현한다.
  SELECT *
  FROM public.public_expert_list l
  WHERE (
      p_professions IS NULL
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(l.professions) e
        WHERE e->>'slug' = ANY(p_professions)
      )
    )
    AND (p_regions IS NULL OR l.workplace_region = ANY(p_regions))
    AND (
      p_specialty_slugs IS NULL
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(l.specialties) e
        WHERE e->>'slug' = ANY(p_specialty_slugs)
      )
    )
    AND (
      p_query IS NULL OR trim(p_query) = ''
      OR l.display_name ILIKE '%' || p_query || '%'
      OR l.headline ILIKE '%' || p_query || '%'
    )
  ORDER BY l.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;
