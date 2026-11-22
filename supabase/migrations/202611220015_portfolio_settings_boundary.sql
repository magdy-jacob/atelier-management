begin;
-- The synthetic boundary is installation configuration, not an app-admin toggle.
-- Migration1 originally granted admin client writes to settings. Remove both the
-- grants and the all-command policy so ordinary authenticated users, including
-- admins, cannot disable synthetic enforcement or change its companion gate.
revoke all on public.settings from public,anon,authenticated;
grant select on public.settings to authenticated;
drop policy if exists settings_admin on public.settings;
create policy settings_admin_read on public.settings for select to authenticated using(public.is_admin());
-- Existing SECURITY DEFINER config reads and atomic workflow functions retain
-- their narrow behavior. Only the database owner configures installation gates.
commit;
