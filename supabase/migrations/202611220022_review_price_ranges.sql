begin;
-- Support user-facing DR/001 codes. Existing codes and UUID references stay valid.
alter table public.dresses drop constraint dresses_code_check;
alter table public.dresses add constraint dresses_code_check check(code ~ '^[a-zA-Z0-9_/-]{1,40}$');
-- Price ranges stay in the existing admin-only table, never on public dress rows.
alter table public.dress_prices add column minimum_price_piasters bigint;
alter table public.dress_prices add column maximum_price_piasters bigint;
alter table public.dress_prices add column version integer not null default 1 check(version>0);
alter table public.dress_prices add constraint valid_price_range check (
 (minimum_price_piasters is null and maximum_price_piasters is null) or
 (minimum_price_piasters is not null and maximum_price_piasters is not null and minimum_price_piasters>=0 and maximum_price_piasters>=minimum_price_piasters and maximum_price_piasters<=9999999999)
);
create trigger bump_price_version before update on public.dress_prices for each row execute function public.bump_dress_version();
create function public.set_dress_price_range(p_dress_id uuid,p_expected_version integer,p_min bigint,p_max bigint) returns void language plpgsql security invoker set search_path='' as $$
declare v integer;
begin
 if not public.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 perform 1 from public.dresses where id=p_dress_id for update;
 if not found then raise exception 'dress_not_found';end if;
 select version into v from public.dress_prices where dress_id=p_dress_id for update;
 if coalesce(v,0) is distinct from p_expected_version then raise exception 'stale_price_version';end if;
 if p_min is null or p_max is null or p_min<0 or p_max<p_min or p_max>9999999999 then raise exception 'invalid_price_range';end if;
 insert into public.dress_prices(dress_id,minimum_price_piasters,maximum_price_piasters) values(p_dress_id,p_min,p_max)
 on conflict(dress_id) do update set minimum_price_piasters=excluded.minimum_price_piasters,maximum_price_piasters=excluded.maximum_price_piasters;
end $$;
revoke all on function public.set_dress_price_range(uuid,integer,bigint,bigint) from public,anon;
grant execute on function public.set_dress_price_range(uuid,integer,bigint,bigint) to authenticated;
create or replace function public.begin_employee_account(p_request_id uuid,p_name text,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.employee_account_jobs;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 p_name:=trim(p_name);p_email:=lower(trim(p_email));
 if p_request_id is null or p_name is null or length(p_name) not between 1 and 120 or p_email is null or length(p_email)>100 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'invalid_employee_identity';end if;
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
create or replace function public.update_employee_profile(p_request_id uuid,p_employee_id uuid,p_expected_version integer,p_name text,p_active boolean,p_reason text) returns integer language plpgsql security definer set search_path='' as $$
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
 if p.full_name=p_name and p.active=p_active then return p.version;end if;
 update public.profiles set full_name=p_name,active=p_active where id=p_employee_id returning version into after_v;
 insert into public.employee_profile_changes(request_id,employee_id,actor_id,reason,old_name,new_name,old_active,new_active,before_version,after_version)
 values(p_request_id,p_employee_id,auth.uid(),p_reason,p.full_name,p_name,p.active,p_active,p.version,after_v);
 return after_v;
end $$;
commit;
