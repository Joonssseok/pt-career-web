-- Keep search text aligned on explicit publish, and respect live privacy controls.
create or replace function public.publish_profile_version(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.profiles%rowtype; v public.profile_versions%rowtype; snapshot jsonb; gallery jsonb;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 select * into p from public.profiles where user_id=uid for update;
 if p.id is null then raise exception '프로필이 없습니다.'; end if;
 if p.suspended_at is not null or p.deletion_requested_at is not null then raise exception '현재 공개할 수 없는 계정입니다.'; end if;
 if p.verification_status<>'approved' or not p.is_public then raise exception '기본 프로필 공개 승인이 먼저 필요합니다.'; end if;
 select * into v from public.profile_versions where id=p_id and owner_id=uid and profile_id=p.id for update;
 if v.id is null then raise exception '공개할 프로필을 찾을 수 없습니다.'; end if;
 update public.profiles set owner_visible=true, headline=v.draft_content->>'headline', introduction=v.draft_content->>'introduction' where id=p.id;
 select to_jsonb(d) into snapshot from public.public_expert_detail d where d.id=p.id;
 if snapshot is null then raise exception '공개 조건을 확인하지 못했습니다.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'imagePath',g.image_path,'caption',coalesce(g.caption,'')) order by g.display_order),'[]'::jsonb) into gallery from public.profile_gallery_images g where g.profile_id=p.id and g.owner_visible;
 update public.profile_versions set is_representative=false where owner_id=uid and is_representative;
 update public.profile_versions set is_representative=true,published_content=draft_content,published_expert=snapshot,published_gallery=gallery,published_at=now() where id=v.id;
end $$;
revoke all on function public.publish_profile_version(uuid) from public;
grant execute on function public.publish_profile_version(uuid) to authenticated;


-- Public reads honor current privacy/revocation settings even for old snapshots.
create or replace function public.get_representative_profiles(p_profile_ids uuid[])
returns table(profile_id uuid,content jsonb,expert jsonb,gallery jsonb)
language sql stable security definer set search_path='' as $$
 select v.profile_id,v.published_content,
 v.published_expert || jsonb_build_object(
 'licenses',d.licenses,
 'experiences',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'experiences') x where d.experiences @> jsonb_build_array(x.value)),'[]'::jsonb),
 'academic_records',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'academic_records') x where d.academic_records @> jsonb_build_array(x.value)),'[]'::jsonb),
 'educations',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'educations') x where d.educations @> jsonb_build_array(x.value)),'[]'::jsonb),
 'professions',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'professions') x where d.professions @> jsonb_build_array(x.value)),'[]'::jsonb),
 'specialties',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'specialties') x where d.specialties @> jsonb_build_array(x.value)),'[]'::jsonb),
 'total_experience_years',case when v.published_expert->'experiences'=d.experiences then v.published_expert->'total_experience_years' else null end,
 'workplace_region',case when d.workplace_region is not null then v.published_expert->'workplace_region' else null end,
 'workplace_center_name',case when d.workplace_center_name is not null then v.published_expert->'workplace_center_name' else null end,
 'workplace_phone',case when d.workplace_phone is not null then v.published_expert->'workplace_phone' else null end,
 'workplace_address',case when d.workplace_address is not null then v.published_expert->'workplace_address' else null end,
 'workplace_address_detail',case when d.workplace_address_detail is not null then v.published_expert->'workplace_address_detail' else null end,
 'workplace_website_url',case when d.workplace_website_url is not null then v.published_expert->'workplace_website_url' else null end,
 'workplace_external_contact_url',case when d.workplace_external_contact_url is not null then v.published_expert->'workplace_external_contact_url' else null end
 ),
 coalesce((select jsonb_agg(img.value) from jsonb_array_elements(coalesce(v.published_gallery,'[]'::jsonb)) img join public.profile_gallery_images g on g.id::text=img.value->>'id' and g.profile_id=v.profile_id and g.owner_visible),'[]'::jsonb)
 from public.profile_versions v join public.profiles p on p.id=v.profile_id
 join public.public_expert_detail d on d.id=p.id
 where v.is_representative and v.profile_id=any(p_profile_ids)
 and p.is_public and p.owner_visible and p.verification_status='approved' and p.suspended_at is null and p.deletion_requested_at is null;
$$;
revoke all on function public.get_representative_profiles(uuid[]) from public;
grant execute on function public.get_representative_profiles(uuid[]) to anon,authenticated;
