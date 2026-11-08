-- Synthetic inputs only. This test does not save or publish a member profile.
DO $test$
DECLARE
 ordering jsonb := '{"sections":["introduction","activity:학력","licenses","activity:협회·전문단체 활동","activity:비공개 분류"],"activity:학력":["hidden-item","visible-academic"],"activity:비공개 분류":["hidden-item"],"unknown-group":["hidden-item"]}'::jsonb;
 activities jsonb := '[{"id":"visible-academic","category":"학력"},{"id":"visible-association","category":"협회·전문단체 활동"}]'::jsonb;
 result jsonb;
BEGIN
 result := public.profile_version_public_order(ordering, '{}'::jsonb, activities);
 IF result->'sections' IS DISTINCT FROM '["introduction","activity:학력","licenses","activity:협회·전문단체 활동"]'::jsonb THEN
  RAISE EXCEPTION 'public activity section order was lost';
 END IF;
 IF result->'activity:학력' IS DISTINCT FROM '["visible-academic"]'::jsonb THEN
  RAISE EXCEPTION 'visible item order was lost';
 END IF;
 IF result ? 'activity:비공개 분류' OR result ? 'unknown-group' OR result::text LIKE '%hidden-item%' OR result::text LIKE '%비공개 분류%' THEN
  RAISE EXCEPTION 'private order metadata was exposed';
 END IF;
 result := public.profile_version_public_order(ordering, '{}'::jsonb, '[]'::jsonb);
 IF result->'sections' IS DISTINCT FROM '["introduction","licenses"]'::jsonb THEN
  RAISE EXCEPTION 'hidden activities retained their section names';
 END IF;
 IF public.profile_version_public_order(NULL, '{}'::jsonb, '[]'::jsonb) IS DISTINCT FROM '{}'::jsonb THEN
  RAISE EXCEPTION 'empty order changed';
 END IF;
 IF (select prosecdef OR provolatile <> 'i' from pg_proc where oid='public.profile_version_public_order(jsonb,jsonb,jsonb)'::regprocedure) THEN
  RAISE EXCEPTION 'order helper privileges or volatility changed';
 END IF;
END $test$;
SELECT 'public activity order and private metadata filtering checks passed' as result;
