-- Run only in an approved test transaction after applying the matching migration.
BEGIN;

DO $test$
DECLARE
  u uuid := gen_random_uuid(); p uuid := gen_random_uuid(); l uuid := gen_random_uuid();
  changed boolean; denied boolean := false; count_before bigint;
BEGIN
  SELECT count(*) INTO count_before FROM public.licenses;
  IF EXISTS(SELECT 1 FROM public.licenses WHERE document_public) THEN RAISE EXCEPTION 'existing files became public'; END IF;
  INSERT INTO auth.users(id,email) VALUES(u, u::text || '@test.invalid');
  INSERT INTO public.profiles(id,user_id,is_public,verification_status) VALUES(p,u,true,'approved');
  INSERT INTO public.licenses(id,profile_id,license_name,document_path_private,document_public)
    VALUES(l,p,'transactional-test',u::text || '/proof.png',true);
  IF EXISTS(SELECT 1 FROM public.get_public_license_details(p)) THEN RAISE EXCEPTION 'pending exposed'; END IF;
  UPDATE public.licenses SET verification_status='verified',is_public=true WHERE id=l;
  IF public.get_public_license_document(l) IS NULL THEN RAISE EXCEPTION 'approved public file missing'; END IF;
  IF NOT public.is_verified_license_evidence(u::text || '/proof.png') THEN RAISE EXCEPTION 'verified proof not locked'; END IF;
  UPDATE public.licenses SET document_public=false WHERE id=l;
  IF NOT EXISTS(SELECT 1 FROM public.get_public_license_details(p)) OR public.get_public_license_document(l) IS NOT NULL
    THEN RAISE EXCEPTION 'private mode must retain badge but hide document'; END IF;
  UPDATE public.licenses SET document_public=true WHERE id=l;
  UPDATE public.profiles SET suspended_at=now() WHERE id=p;
  IF EXISTS(SELECT 1 FROM public.get_public_license_details(p)) OR public.is_license_evidence_public(u::text || '/proof.png')
    THEN RAISE EXCEPTION 'suspended profile exposed'; END IF;
  UPDATE public.profiles SET suspended_at=null,owner_visible=false WHERE id=p;
  IF public.get_public_license_document(l) IS NOT NULL THEN RAISE EXCEPTION 'hidden profile exposed'; END IF;
  UPDATE public.profiles SET owner_visible=true WHERE id=p;
  UPDATE public.licenses SET owner_visible=false WHERE id=l;
  IF public.get_public_license_document(l) IS NOT NULL THEN RAISE EXCEPTION 'hidden license exposed'; END IF;
  UPDATE public.licenses SET owner_visible=true,verification_status='rejected' WHERE id=l;
  IF public.get_public_license_document(l) IS NOT NULL THEN RAISE EXCEPTION 'rejected license exposed'; END IF;
  UPDATE public.licenses SET verification_status='verified' WHERE id=l;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  SELECT ok INTO changed FROM public.set_own_license_document_visibility(l,false);
  IF changed THEN RAISE EXCEPTION 'another owner changed consent'; END IF;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  SELECT ok INTO changed FROM public.set_own_license_document_visibility(l,false);
  IF NOT changed OR NOT EXISTS(SELECT 1 FROM public.licenses WHERE id=l AND verification_status='verified')
    THEN RAISE EXCEPTION 'consent-only change lost badge'; END IF;
  UPDATE public.licenses SET document_path_private=u::text || '/new.png' WHERE id=l;
  IF EXISTS(SELECT 1 FROM public.licenses WHERE id=l AND verification_status='verified')
    THEN RAISE EXCEPTION 'changed evidence kept approval'; END IF;
  BEGIN
    UPDATE public.licenses SET verification_status='verified' WHERE id=l;
  EXCEPTION WHEN OTHERS THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'owner self-verified'; END IF;
  denied := false;
  BEGIN
    INSERT INTO public.licenses(profile_id,license_name,verification_status) VALUES(p,'self-verified','verified');
  EXCEPTION WHEN OTHERS THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'owner inserted verified license'; END IF;
  IF has_function_privilege('anon','public.set_own_license_document_visibility(uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'anonymous write allowed';
  END IF;
  IF NOT has_function_privilege('anon','public.get_public_license_details(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'anonymous approved read unavailable';
  END IF;
END;
$test$;
ROLLBACK;
SELECT 'permission and approval matrix passed; fixture and schema rolled back' AS result;
