begin;
alter table public.categories add column version integer not null default 1 check(version>0);
create function public.bump_category_version() returns trigger language plpgsql set search_path='' as $$
begin NEW.version:=OLD.version+1;return NEW;end $$;
revoke execute on function public.bump_category_version() from public,anon,authenticated;
create trigger bump_version before update on public.categories for each row execute function public.bump_category_version();
revoke update,delete on public.categories from public,anon,authenticated;
drop policy categories_admin on public.categories;
create policy categories_insert_admin on public.categories for insert to authenticated with check(public.is_admin());
-- Preserve all used categories, including references from archived dresses.
-- No activation/visibility policy is changed here.
create function public.manage_category(p_id uuid,p_version integer,p_name text,p_delete boolean default false) returns integer language plpgsql security definer set search_path='' as $$
declare c public.categories;new_version integer;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_version is null or p_version<=0 or p_delete is null then raise exception 'invalid_category';end if;
 select * into c from public.categories where id=p_id for update;
 if not found then raise exception 'category_not_found';end if;
 if c.version<>p_version then raise exception 'category_stale';end if;
 if p_delete then
  if exists(select 1 from public.dresses where category_id=p_id) then raise exception 'category_in_use';end if;
  delete from public.categories where id=p_id;
  return c.version;
 end if;
 p_name:=trim(p_name);
 if p_name is null or length(p_name) not between 1 and 80 then raise exception 'invalid_category';end if;
 update public.categories set name=p_name where id=p_id returning version into new_version;
 return new_version;
end $$;
revoke execute on function public.manage_category(uuid,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.manage_category(uuid,integer,text,boolean) to authenticated;
commit;
