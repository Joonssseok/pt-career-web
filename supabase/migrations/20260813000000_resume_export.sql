-- 이력서 내보내기(Word 자동생성) 기능 -- 개인 연락처(resume_phone) 컬럼 신설.
--
-- 보안 판단(중요): profiles는 컬럼 단위 GRANT를 쓰는 테이블이고,
-- authenticated 롤에는 "본인 행"(auth_select_own_or_public) 정책과
-- "공개 승인된 타인 프로필 조회"(auth_select_public) 정책이 OR로 결합돼
-- 있다. RLS는 행 단위로만 필터링하므로, resume_phone 컬럼을
-- authenticated에 넓게 GRANT하면 다른 사람의 공개 프로필을 조회할 때도
-- (그 요청이 auth_select_public 정책으로 허용되는 행이라도) 값이 함께
-- 내려간다 -- 즉 전화번호가 전체 로그인 사용자에게 새는 구멍이 생긴다.
-- 그래서 이 컬럼은 anon/authenticated 어디에도 컬럼 GRANT를 주지 않고,
-- 읽기/쓰기 모두 SECURITY DEFINER RPC로만 접근하게 한다(RPC 내부에서
-- auth.uid() = user_id를 직접 확인하므로 행 단위 소유권 검증이 확실함).

ALTER TABLE public.profiles ADD COLUMN resume_phone text;

-- save_own_profile: p_resume_phone 파라미터 추가. 시그니처 변경이므로
-- DROP 후 재생성(이 저장소에서 반복된 PostgREST 오버로드 모호성 함정).
DROP FUNCTION public.save_own_profile(text, text, text, text, text, text, text, text, text, text);

CREATE FUNCTION public.save_own_profile(
  p_display_name text,
  p_headline text,
  p_introduction text,
  p_profile_image_path text,
  p_cover_image_path text DEFAULT NULL,
  p_youtube_url text DEFAULT NULL,
  p_instagram_url text DEFAULT NULL,
  p_blog_url text DEFAULT NULL,
  p_threads_url text DEFAULT NULL,
  p_kakao_url text DEFAULT NULL,
  p_resume_phone text DEFAULT NULL
)
 RETURNS TABLE(ok boolean, error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NOT NULL AND v_status = 'pending' THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow editing'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.profiles (
    user_id, display_name, headline, introduction, profile_image_path,
    cover_image_path, youtube_url, instagram_url, blog_url, threads_url, kakao_url,
    resume_phone
  )
  VALUES (
    v_user_id, p_display_name, p_headline, p_introduction, p_profile_image_path,
    p_cover_image_path, p_youtube_url, p_instagram_url, p_blog_url, p_threads_url, p_kakao_url,
    p_resume_phone
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    headline = EXCLUDED.headline,
    introduction = EXCLUDED.introduction,
    profile_image_path = EXCLUDED.profile_image_path,
    cover_image_path = EXCLUDED.cover_image_path,
    youtube_url = EXCLUDED.youtube_url,
    instagram_url = EXCLUDED.instagram_url,
    blog_url = EXCLUDED.blog_url,
    threads_url = EXCLUDED.threads_url,
    kakao_url = EXCLUDED.kakao_url,
    resume_phone = EXCLUDED.resume_phone,
    updated_at = now();

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_own_profile(text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_own_profile(text, text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;

-- 이력서 다운로드/EditForm 미리채우기용 조회 전용 RPC. 컬럼 GRANT를 쓰지
-- 않고 이 함수로만 읽게 해서, 위에서 설명한 "공개 프로필 조회 시 남의
-- 전화번호가 같이 내려가는" 경로 자체를 차단한다.
CREATE FUNCTION public.get_own_resume_phone()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_phone TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT resume_phone INTO v_phone FROM public.profiles WHERE user_id = v_user_id;
  RETURN v_phone;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_own_resume_phone() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_resume_phone() TO authenticated, service_role;
