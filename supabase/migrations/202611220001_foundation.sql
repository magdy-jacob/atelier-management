-- Atelier foundation, 2026-11-22. Apply to a fresh Supabase project only.
-- No production policies are enabled by this migration. See docs/DECISIONS.md.
begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;
revoke create on schema public from public;

create table public.profiles (
 id uuid primary key references auth.users(id), full_name text not null check(length(full_name) between 1 and 120),
 role text not null check(role in ('admin','employee')), active boolean not null default true,
 created_at timestamptz not null default now()
);
create function public.staff_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid() and active=true
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.staff_role()='admin',false)
$$;
create function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.staff_role() in ('admin','employee'),false)
$$;

create table public.settings (
 id boolean primary key default true check(id),
 live_bookings_enabled boolean not null default false,
 date_precision text check(date_precision='day'), -- Hour precision requires a new migration, not a silent reinterpretation.
 business_timezone text, same_day_allowed boolean,
 payment_methods text[] not null default '{}',
 created_at timestamptz not null default now()
);
insert into public.settings(id) values(true);

create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 80), active boolean not null default true);
create table public.dresses (
 id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[a-zA-Z0-9_-]{1,40}$'),
 name text not null check(length(name) between 1 and 120), color text not null check(length(color) between 1 and 60),
 size text not null check(length(size) between 1 and 30),category_id uuid not null references public.categories(id),
 public_availability text not null default 'unavailable' check(public_availability in ('available','reserved','unavailable')),
 archived boolean not null default false,created_at timestamptz not null default now()
);
-- A separate table is essential: RLS does not conceal selected columns.
create table public.dress_prices (dress_id uuid primary key references public.dresses(id), advisory_price_piasters bigint check(advisory_price_piasters>=0),note text);
-- Pricing shape is deliberately not exposed to the UI until the owner chooses single-price vs range.
create table public.dress_operations (dress_id uuid primary key references public.dresses(id), status text not null default 'in_atelier' check(status in ('in_atelier','outside','preparation','maintenance')));
create table public.dress_images (id uuid primary key default gen_random_uuid(),dress_id uuid not null references public.dresses(id),path text not null unique,sort_order integer not null default 0 check(sort_order>=0));
create table public.customers (id uuid primary key default gen_random_uuid(),full_name text not null check(length(full_name) between 1 and 120),phone text not null check(length(phone) between 5 and 24),created_at timestamptz not null default now());
-- No unique phone constraint: matching/reuse policy is not approved.
create table public.bookings (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 dress_id uuid not null references public.dresses(id),customer_id uuid not null references public.customers(id),
 starts_on date not null,returns_on date not null check(returns_on>=starts_on),
 agreed_price_piasters bigint not null check(agreed_price_piasters>0 and agreed_price_piasters<=9999999999),
 status text not null default 'confirmed' check(status in ('confirmed','out','returned','cancelled')),
 created_by uuid not null references public.profiles(id),assigned_to uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 -- Dec 5-6 booking occupies [Dec5,Dec8): Dec7 is preparation. Dec8 is next available.
 occupied daterange generated always as(daterange(starts_on,returns_on+2,'[)')) stored,
 constraint no_dress_overlap exclude using gist (dress_id with =,occupied with &&) where(status <> 'cancelled')
);
create index bookings_customer_idx on public.bookings(customer_id);
create index bookings_staff_idx on public.bookings(created_by,assigned_to);
create index bookings_return_idx on public.bookings(returns_on) where status='out';
create function public.can_access_booking(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_staff() and exists(select 1 from public.bookings where id=p_id and (public.is_admin() or created_by=auth.uid() or assigned_to=auth.uid()))
$$;
create table public.payments (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 booking_id uuid not null references public.bookings(id),amount_piasters bigint not null check(amount_piasters>0 and amount_piasters<=9999999999),
 method text not null check(length(method) between 1 and 40),kind text not null check(kind in ('deposit','payment')),
 recorded_by uuid not null references public.profiles(id),recorded_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments(booking_id);
create table public.late_fees (id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id),amount_piasters bigint not null check(amount_piasters>0 and amount_piasters<=9999999999),reason text not null check(length(reason) between 1 and 500),recorded_by uuid not null references public.profiles(id) default auth.uid(),created_at timestamptz not null default now());
create table public.activity_logs (id bigint generated always as identity primary key,actor_id uuid,action text not null,entity text not null,entity_id text,old_data jsonb,new_data jsonb,created_at timestamptz not null default now());
create index activity_time_idx on public.activity_logs(created_at desc);
create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.activity_logs(actor_id,action,entity,entity_id,old_data,new_data)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id',to_jsonb(NEW)->>'dress_id',to_jsonb(OLD)->>'dress_id'),case when TG_OP<>'INSERT' then to_jsonb(OLD) end,case when TG_OP<>'DELETE' then to_jsonb(NEW) end);
 return coalesce(NEW,OLD);
end $$;
-- Public-facing data is free of prices, customer details, internal notes and operating status.
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.dresses enable row level security;
alter table public.dress_prices enable row level security;
alter table public.dress_operations enable row level security;
alter table public.dress_images enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.late_fees enable row level security;
alter table public.activity_logs enable row level security;

create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
-- No profile mutation from client tokens. Prevent self-promotion and deactivation bypass.
create policy settings_admin on public.settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy categories_read on public.categories for select to anon,authenticated using(active or public.is_staff());
create policy categories_admin on public.categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy dresses_read on public.dresses for select to anon,authenticated using(not archived or public.is_staff());
create policy dresses_admin on public.dresses for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy prices_admin on public.dress_prices for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy operations_read on public.dress_operations for select to authenticated using(public.is_staff());
create policy operations_admin on public.dress_operations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy images_read on public.dress_images for select to anon,authenticated using(exists(select 1 from public.dresses where id=dress_id and (not archived or public.is_staff())));
create policy images_admin on public.dress_images for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy customer_read on public.customers for select to authenticated using(public.is_admin() or exists(select 1 from public.bookings b where b.customer_id=customers.id and public.can_access_booking(b.id)));
create policy bookings_read on public.bookings for select to authenticated using(public.can_access_booking(id));
create policy payments_read on public.payments for select to authenticated using(public.can_access_booking(booking_id));
create policy fees_read on public.late_fees for select to authenticated using(public.can_access_booking(booking_id));
create policy fees_insert on public.late_fees for insert to authenticated with check(public.is_admin() and recorded_by=auth.uid());
create policy audit_admin on public.activity_logs for select to authenticated using(public.is_admin());

-- Mutations crossing multiple rows go through atomic, role-checked RPCs only.
create function public.create_booking(p_request_id uuid,p_dress_id uuid,p_customer_name text,p_phone text,p_start date,p_return date,p_total bigint,p_deposit bigint,p_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.settings; booking_id uuid; customer_id uuid; prior public.bookings; local_today date;
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 select * into prior from public.bookings where request_id=p_request_id;
 if found then
  if prior.created_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  return prior.id;
 end if;
 select * into s from public.settings where id=true;
 if not s.live_bookings_enabled or s.date_precision is distinct from 'day' or s.same_day_allowed is null or s.business_timezone is null then raise exception 'policy_decisions_pending';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=s.business_timezone) then raise exception 'invalid_timezone';end if;
 local_today:=(now() at time zone s.business_timezone)::date;
 if p_start is null or p_return is null or p_start<local_today or p_return<p_start or (p_start=local_today and not s.same_day_allowed) then raise exception 'invalid_dates_or_same_day_policy';end if;
 if p_total is null or p_deposit is null or p_total<=0 or p_total>9999999999 or p_deposit<0 or p_deposit>p_total then raise exception 'invalid_amount';end if;
 if p_customer_name is null or length(trim(p_customer_name)) not between 1 and 120 or p_phone is null or length(trim(p_phone)) not between 5 and 24 then raise exception 'invalid_customer';end if;
 if p_deposit>0 and (p_method is null or not(p_method=any(s.payment_methods))) then raise exception 'payment_method_not_approved';end if;
 -- Row lock also serializes against archiving and concurrent booking mutations.
 perform 1 from public.dresses where id=p_dress_id and not archived for update;
 if not found then raise exception 'dress_not_found';end if;
 if exists(select 1 from public.dress_operations where dress_id=p_dress_id and status in ('outside','maintenance')) then raise exception 'dress_operationally_unavailable';end if;
 insert into public.customers(full_name,phone) values(trim(p_customer_name),trim(p_phone)) returning id into customer_id;
 insert into public.bookings(request_id,dress_id,customer_id,starts_on,returns_on,agreed_price_piasters,created_by,assigned_to)
 values(p_request_id,p_dress_id,customer_id,p_start,p_return,p_total,auth.uid(),auth.uid()) returning id into booking_id;
 if p_deposit>0 then insert into public.payments(request_id,booking_id,amount_piasters,method,kind,recorded_by) values(p_request_id,booking_id,p_deposit,p_method,'deposit',auth.uid());end if;
 return booking_id;
end $$;

create function public.record_payment(p_request_id uuid,p_booking_id uuid,p_amount bigint,p_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings; paid bigint; fees bigint; payment_id uuid; prior public.payments;
begin
 if not public.can_access_booking(p_booking_id) then raise exception 'not_authorized' using errcode='42501';end if;
 select * into prior from public.payments where request_id=p_request_id;
 if found then
  if prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  return prior.id;
 end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and p_method=any(payment_methods)) then raise exception 'policy_decisions_pending';end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if b.status not in ('confirmed','out') then raise exception 'booking_not_payable';end if;
 select coalesce(sum(amount_piasters),0) into paid from public.payments where booking_id=p_booking_id;
 select coalesce(sum(amount_piasters),0) into fees from public.late_fees where booking_id=p_booking_id;
 if p_amount is null or p_amount<=0 or p_amount>9999999999 or paid+p_amount>b.agreed_price_piasters+fees then raise exception 'invalid_amount_or_overpayment';end if;
 insert into public.payments(request_id,booking_id,amount_piasters,method,kind,recorded_by) values(p_request_id,p_booking_id,p_amount,p_method,'payment',auth.uid()) returning id into payment_id;
 return payment_id;
end $$;

create function public.set_dress_operation(p_dress_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_status not in ('in_atelier','preparation','maintenance') or p_status is null then raise exception 'invalid_state';end if;
 -- Outside transitions must go through an approved handover flow, not this helper.
 if exists(select 1 from public.bookings where dress_id=p_dress_id and status='out') then raise exception 'return_workflow_required';end if;
 insert into public.dress_operations(dress_id,status) values(p_dress_id,p_status) on conflict(dress_id) do update set status=excluded.status;
end $$;

-- Remove implicit access; explicitly grant only expected operations.
revoke all on all tables in schema public from anon,authenticated;
revoke all on all sequences in schema public from anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant select on public.categories,public.dresses,public.dress_images to anon,authenticated;
grant select on public.profiles,public.customers,public.bookings,public.payments,public.activity_logs to authenticated;
grant select,insert,update on public.settings,public.categories,public.dresses,public.dress_prices,public.dress_operations,public.dress_images to authenticated;
grant select,insert on public.late_fees to authenticated;
grant execute on function public.staff_role(),public.is_admin(),public.is_staff() to anon,authenticated;
grant execute on function public.can_access_booking(uuid) to authenticated;
grant execute on function public.create_booking(uuid,uuid,text,text,date,date,bigint,bigint,text),public.record_payment(uuid,uuid,bigint,text),public.set_dress_operation(uuid,text) to authenticated;
-- Bookings, payments and audit rows are append-only from user tokens.
-- No cancellation/refund/handover RPC exists until the corresponding policy is approved.

do $$declare t text;begin
 foreach t in array array['profiles','settings','categories','dresses','dress_prices','dress_operations','dress_images','customers','bookings','payments','late_fees'] loop
 execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
 end loop;
end $$;

-- Public bucket is ONLY for dress catalogue assets, never customer documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('dress-images','dress-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy dress_images_metadata_admin on storage.objects for select to authenticated using(bucket_id='dress-images' and public.is_admin());
create policy dress_images_upload_admin on storage.objects for insert to authenticated with check(bucket_id='dress-images' and public.is_admin());
create policy dress_images_update_admin on storage.objects for update to authenticated using(bucket_id='dress-images' and public.is_admin()) with check(bucket_id='dress-images' and public.is_admin());
create policy dress_images_delete_admin on storage.objects for delete to authenticated using(bucket_id='dress-images' and public.is_admin());
commit;
