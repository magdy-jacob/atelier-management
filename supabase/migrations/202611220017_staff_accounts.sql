begin;
alter table public.profiles add column version integer not null default 1 check(version>0);
create function public.bump_profile_version() returns trigger language plpgsql set search_path='' as $$begin new.version:=old.version+1;return new;end $$;
create trigger profile_version before update on public.profiles for each row execute function public.bump_profile_version();
revoke execute on function public.bump_profile_version() from public,anon,authenticated;

create table public.employee_account_jobs (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 actor_id uuid not null references public.profiles(id),user_id uuid not null unique default gen_random_uuid(),
 full_name text not null check(length(full_name) between 1 and 120),
 email text not null check(length(email)<=100),status text not null default 'pending' check(status in ('pending','completed')),
 created_at timestamptz not null default now(),completed_at timestamptz
);
alter table public.employee_account_jobs enable row level security;
revoke all on public.employee_account_jobs from public,anon,authenticated;
grant select on public.employee_account_jobs to authenticated;
create policy employee_jobs_admin_read on public.employee_account_jobs for select to authenticated using(public.is_admin());
create trigger employee_jobs_audit after insert or update on public.employee_account_jobs for each row execute function public.audit_change();

create function public.begin_employee_account(p_request_id uuid,p_name text,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.employee_account_jobs;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 p_name:=trim(p_name);p_email:=lower(trim(p_email));
 if p_request_id is null or p_name is null or length(p_name) not between 8 and 120 or p_name not like 'اختبار %' or p_email is null or p_email !~ '^test-[a-z0-9][a-z0-9._-]{0,39}@example[.]invalid$' then raise exception 'synthetic_employee_required';end if;
 perform 1 from public.settings where id=true and synthetic_test_enabled for update;
 if not found then raise exception 'functional_portfolio_required';end if;
 select * into j from public.employee_account_jobs where request_id=p_request_id;
 if found then
  if j.actor_id<>auth.uid() then raise exception 'request_id_conflict';end if;
  if j.full_name<>p_name or j.email<>p_email then raise exception 'request_id_payload_mismatch';end if;
  return to_jsonb(j);
 end if;
 if exists(select 1 from public.employee_account_jobs where email=p_email) then raise exception 'employee_email_has_job';end if;
 insert into public.employee_account_jobs(request_id,actor_id,full_name,email) values(p_request_id,auth.uid(),p_name,p_email) returning * into j;
 return to_jsonb(j);
end $$;
revoke execute on function public.begin_employee_account(uuid,text,text) from public,anon,authenticated;
grant execute on function public.begin_employee_account(uuid,text,text) to authenticated;

-- Backend-only. The server verifies Auth user id/email/private app_metadata
-- against this durable job before calling. No client can select its target id.
create function public.complete_employee_account(p_job_id uuid,p_actor_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare j public.employee_account_jobs;p public.profiles;
begin
 if not exists(select 1 from public.profiles where id=p_actor_id and active and role='admin') then raise exception 'active_admin_required';end if;
 select * into j from public.employee_account_jobs where id=p_job_id for update;
 if not found or j.actor_id<>p_actor_id then raise exception 'account_job_not_owned';end if;
 if not exists(select 1 from public.settings where id=true and synthetic_test_enabled) then raise exception 'functional_portfolio_required';end if;
 select * into p from public.profiles where id=j.user_id;
 if found then
  if j.status<>'completed' or p.role<>'employee' then raise exception 'profile_binding_conflict';end if;
  return p.id;
 end if;
 if j.status='completed' then raise exception 'completed_profile_missing';end if;
 if not exists(select 1 from auth.users where id=j.user_id) then raise exception 'auth_user_missing';end if;
 insert into public.profiles(id,full_name,role,active) values(j.user_id,j.full_name,'employee',true);
 update public.employee_account_jobs set status='completed',completed_at=now() where id=j.id;
 return j.user_id;
end $$;
revoke execute on function public.complete_employee_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_employee_account(uuid,uuid) to service_role;

create table public.employee_profile_changes (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 employee_id uuid not null references public.profiles(id),actor_id uuid not null references public.profiles(id),
 reason text not null check(length(reason) between 1 and 500),
 old_name text not null,new_name text not null,old_active boolean not null,new_active boolean not null,
 before_version integer not null,after_version integer not null,created_at timestamptz not null default now()
);
alter table public.employee_profile_changes enable row level security;
revoke all on public.employee_profile_changes from public,anon,authenticated;
grant select on public.employee_profile_changes to authenticated;
create policy employee_change_admin_read on public.employee_profile_changes for select to authenticated using(public.is_admin());
create trigger employee_change_audit after insert on public.employee_profile_changes for each row execute function public.audit_change();
create function public.update_employee_profile(p_request_id uuid,p_employee_id uuid,p_expected_version integer,p_name text,p_active boolean,p_reason text) returns integer language plpgsql security definer set search_path='' as $$
declare p public.profiles;prior public.employee_profile_changes;after_v integer;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 p_name:=trim(p_name);p_reason:=trim(p_reason);
 if p_request_id is null or p_expected_version is null or p_name is null or length(p_name) not between 1 and 120 or p_active is null or p_reason is null or length(p_reason) not between 1 and 500 then raise exception 'invalid_employee_change';end if;
 if not exists(select 1 from public.settings where id=true and synthetic_test_enabled) then raise exception 'functional_portfolio_required';end if;
 select * into p from public.profiles where id=p_employee_id for update;
 if not found then raise exception 'employee_not_found';end if;
 if p.role<>'employee' or p.id=auth.uid() then raise exception 'admin_profile_protected';end if;
 select * into prior from public.employee_profile_changes where request_id=p_request_id;
 if found then
  if prior.actor_id<>auth.uid() or prior.employee_id<>p_employee_id then raise exception 'request_id_conflict';end if;
  if prior.before_version<>p_expected_version or prior.new_name<>p_name or prior.new_active<>p_active or prior.reason<>p_reason then raise exception 'request_id_payload_mismatch';end if;
  return prior.after_version;
 end if;
 if p.version<>p_expected_version then raise exception 'stale_employee_version';end if;
 if p.full_name is distinct from p_name and (p_name not like 'اختبار %' or length(p_name)<8) then raise exception 'synthetic_employee_required';end if;
 if p.full_name=p_name and p.active=p_active then return p.version;end if;
 update public.profiles set full_name=p_name,active=p_active where id=p_employee_id returning version into after_v;
 insert into public.employee_profile_changes(request_id,employee_id,actor_id,reason,old_name,new_name,old_active,new_active,before_version,after_version)
 values(p_request_id,p_employee_id,auth.uid(),p_reason,p.full_name,p_name,p.active,p_active,p.version,after_v);
 return after_v;
end $$;
revoke execute on function public.update_employee_profile(uuid,uuid,integer,text,boolean,text) from public,anon,authenticated;
grant execute on function public.update_employee_profile(uuid,uuid,integer,text,boolean,text) to authenticated;
create function public.get_staff_management_config() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 return (select jsonb_build_object('ready',true,'synthetic_test_enabled',synthetic_test_enabled) from public.settings where id=true);
end $$;
revoke execute on function public.get_staff_management_config() from public,anon,authenticated;
grant execute on function public.get_staff_management_config() to authenticated;
commit;
