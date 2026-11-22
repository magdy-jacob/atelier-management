-- NEW ISOLATED TARGET ONLY, after migration + data restore.
-- Read-only integrity sweep. FK constraints may have been bypassed during COPY;
-- this explicitly checks existing rows instead of trusting convalidated=true.
do $$
declare fk record; child_not_null text; matched text; bad boolean;
begin
 for fk in
  select x.oid,x.conname,x.conrelid,x.confrelid,x.conkey,x.confkey
  from pg_constraint x join pg_class c on c.oid=x.conrelid
  join pg_namespace n on n.oid=c.relnamespace
  where x.contype='f' and n.nspname='public'
 loop
  select string_agg(format('c.%I is not null',ca.attname),' and ' order by k.ord),
         string_agg(format('p.%I = c.%I',pa.attname,ca.attname),' and ' order by k.ord)
    into child_not_null,matched
  from unnest(fk.conkey,fk.confkey) with ordinality k(childatt,parentatt,ord)
  join pg_attribute ca on ca.attrelid=fk.conrelid and ca.attnum=k.childatt
  join pg_attribute pa on pa.attrelid=fk.confrelid and pa.attnum=k.parentatt;
  execute format('select exists(select 1 from %s c where %s and not exists(select 1 from %s p where %s))',fk.conrelid::regclass,child_not_null,fk.confrelid::regclass,matched) into bad;
  if bad then raise exception 'Dangling reference: %',fk.conname;end if;
 end loop;
 if exists(
  select 1 from public.employee_account_jobs j left join auth.users u on u.id=j.user_id
  where (j.status='completed' and u.id is null)
     or (u.id is not null and (u.email is distinct from j.email
      or u.raw_app_meta_data->>'lovely_staff_job' is distinct from j.id::text
      or u.raw_app_meta_data->>'lovely_staff_actor' is distinct from j.actor_id::text))
 ) then raise exception 'Employee Auth job binding mismatch';end if;
end $$;
