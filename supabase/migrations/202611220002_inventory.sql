begin;
alter table public.dresses add column version integer not null default 1 check(version>0);
create function public.bump_dress_version() returns trigger language plpgsql set search_path='' as $$
begin NEW.version:=OLD.version+1;return NEW;end $$;
revoke execute on function public.bump_dress_version() from public,anon,authenticated;
create trigger bump_version before update on public.dresses for each row execute function public.bump_dress_version();
commit;
