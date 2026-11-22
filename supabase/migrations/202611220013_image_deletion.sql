begin;
create table public.image_deletion_jobs(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,image_id uuid not null unique,
 dress_id uuid not null references public.dresses(id),path text not null unique,
 status text not null default 'pending' check(status in ('pending','completed')),
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),completed_at timestamptz,
 check((status='pending' and completed_at is null) or (status='completed' and completed_at is not null))
);
alter table public.image_deletion_jobs enable row level security;
create policy image_cleanup_admin_read on public.image_deletion_jobs for select to authenticated using(public.is_admin());
revoke all on public.image_deletion_jobs from public,anon,authenticated;
grant select on public.image_deletion_jobs to authenticated;
create trigger audit_image_deletion_jobs after insert or update or delete on public.image_deletion_jobs for each row execute function public.audit_change();
-- A retired object path cannot be reattached between metadata removal and Storage cleanup.
create or replace function public.append_dress_image_position() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.dresses where id=new.dress_id for update;
 if exists(select 1 from public.image_deletion_jobs where path=new.path) then raise exception 'image_path_retired';end if;
 select coalesce(max(sort_order),-1)+1 into new.sort_order from public.dress_images where dress_id=new.dress_id;
 return new;
end $$;
create function public.queue_dress_image_delete(p_request_id uuid,p_dress_id uuid,p_image_id uuid,p_expected_version int,p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior public.image_deletion_jobs;image public.dress_images;v int;job public.image_deletion_jobs;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_request_id is null or p_confirm is distinct from true then raise exception 'explicit_delete_confirmation_required';end if;
 select * into prior from public.image_deletion_jobs where request_id=p_request_id;
 if found then
  if prior.dress_id is distinct from p_dress_id or prior.image_id is distinct from p_image_id or prior.recorded_by is distinct from auth.uid() then raise exception 'request_id_conflict';end if;
  return to_jsonb(prior);
 end if;
 select version into v from public.dresses where id=p_dress_id for update;
 if not found then raise exception 'dress_not_found';end if;
 select * into prior from public.image_deletion_jobs where request_id=p_request_id;
 if found then
  if prior.dress_id is distinct from p_dress_id or prior.image_id is distinct from p_image_id or prior.recorded_by is distinct from auth.uid() then raise exception 'request_id_conflict';end if;
  return to_jsonb(prior);
 end if;
 if p_expected_version is distinct from v then raise exception 'stale_dress_version' using errcode='40001';end if;
 select * into image from public.dress_images where id=p_image_id and dress_id=p_dress_id;
 if not found then raise exception 'image_missing_refresh';end if;
 insert into public.image_deletion_jobs(request_id,image_id,dress_id,path,recorded_by) values(p_request_id,p_image_id,p_dress_id,image.path,auth.uid()) returning * into job;
 delete from public.dress_images where id=p_image_id;
 update public.dresses set version=version where id=p_dress_id;
 return to_jsonb(job);
end $$;
create function public.complete_dress_image_delete(p_job_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare job public.image_deletion_jobs;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 select * into job from public.image_deletion_jobs where id=p_job_id for update;
 if not found then raise exception 'cleanup_job_not_found';end if;
 if job.status='completed' then return;end if;
 if exists(select 1 from public.dress_images where path=job.path) then raise exception 'image_path_still_referenced';end if;
 if exists(select 1 from storage.objects where bucket_id='dress-images' and name=job.path) then raise exception 'storage_object_still_present';end if;
 update public.image_deletion_jobs set status='completed',completed_at=now() where id=job.id;
end $$;
revoke execute on function public.queue_dress_image_delete(uuid,uuid,uuid,int,boolean),public.complete_dress_image_delete(uuid) from public,anon,authenticated;
grant execute on function public.queue_dress_image_delete(uuid,uuid,uuid,int,boolean),public.complete_dress_image_delete(uuid) to authenticated;
commit;
