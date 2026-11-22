begin;
-- Metadata inserts append under the parent lock, including uploads from older clients.
-- No existing image/fixture rows change when this migration is applied.
create function public.append_dress_image_position() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.dresses where id=new.dress_id for update;
 select coalesce(max(sort_order),-1)+1 into new.sort_order from public.dress_images where dress_id=new.dress_id;
 return new;
end $$;
create function public.note_dress_image_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.dresses set version=version where id=new.dress_id;
 return new;
end $$;
revoke execute on function public.append_dress_image_position(),public.note_dress_image_insert() from public,anon,authenticated;
create trigger image_append_position before insert on public.dress_images for each row execute function public.append_dress_image_position();
create trigger image_insert_version after insert on public.dress_images for each row execute function public.note_dress_image_insert();
revoke update on public.dress_images from authenticated;
create function public.reorder_dress_images(p_dress_id uuid,p_expected_version int,p_image_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare v int;existing uuid[];
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 select version into v from public.dresses where id=p_dress_id for update;
 if not found then raise exception 'dress_not_found';end if;
 if p_image_ids is null or coalesce(array_ndims(p_image_ids),1)<>1 then raise exception 'invalid_image_list';end if;
 if array_position(p_image_ids,null) is not null then raise exception 'invalid_image_list';end if;
 select coalesce(array_agg(id order by sort_order,id),'{}'::uuid[]) into existing from public.dress_images where dress_id=p_dress_id;
 if cardinality(p_image_ids)<>cardinality(existing) or cardinality(p_image_ids)<>(select count(distinct i) from unnest(p_image_ids) i) or not (p_image_ids @> existing and existing @> p_image_ids) then raise exception 'image_set_changed_refresh';end if;
 -- Exact result already present: safe retry without new writes/audit/version.
 if p_image_ids=existing then return jsonb_build_object('version',v,'unchanged',true);end if;
 if p_expected_version is distinct from v then raise exception 'stale_dress_version' using errcode='40001';end if;
 update public.dress_images i set sort_order=(o.position-1)::int from unnest(p_image_ids) with ordinality o(id,position) where i.id=o.id and i.dress_id=p_dress_id and i.sort_order<>(o.position-1)::int;
 update public.dresses set version=version where id=p_dress_id returning version into v;
 return jsonb_build_object('version',v,'unchanged',false);
end $$;
revoke execute on function public.reorder_dress_images(uuid,int,uuid[]) from public,anon,authenticated;
grant execute on function public.reorder_dress_images(uuid,int,uuid[]) to authenticated;
commit;
