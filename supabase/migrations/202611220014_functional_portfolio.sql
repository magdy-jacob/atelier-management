begin;
-- Opt-in functional portfolio mode. Applying this migration does not enable writes.
alter table public.settings add column synthetic_test_enabled boolean not null default false;
create table public.synthetic_customers(customer_id uuid primary key references public.customers(id) on delete cascade);
create table public.synthetic_bookings(booking_id uuid primary key references public.bookings(id) on delete cascade);
alter table public.synthetic_customers enable row level security;
alter table public.synthetic_bookings enable row level security;
revoke all on public.synthetic_customers,public.synthetic_bookings from public,anon,authenticated;
-- The registry is an enforcement boundary, not a user-editable synthetic checkbox.
create function public.enforce_portfolio_data() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;is_test boolean;
begin
 select synthetic_test_enabled into is_test from public.settings where id=true;
 if not coalesce(is_test,false) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_table_name='customers' then
  if tg_op='INSERT' then
   if new.full_name not like 'اختبار %' or new.phone !~ '^TEST-[A-Za-z0-9_-]{1,18}$' then raise exception 'synthetic_customer_required';end if;
  else
   if not exists(select 1 from public.synthetic_customers where customer_id=old.id) then raise exception 'synthetic_customer_required';end if;
   if tg_op='UPDATE' and (new.full_name is distinct from old.full_name or new.phone is distinct from old.phone) and (new.full_name not like 'اختبار %' or new.phone !~ '^TEST-[A-Za-z0-9_-]{1,18}$') then raise exception 'synthetic_customer_required';end if;
  end if;
 elsif tg_table_name='bookings' then
  if tg_op<>'INSERT' and not exists(select 1 from public.synthetic_bookings where booking_id=old.id) then raise exception 'synthetic_booking_required';end if;
  if tg_op<>'DELETE' and not exists(select 1 from public.synthetic_customers where customer_id=new.customer_id) then raise exception 'synthetic_customer_required';end if;
 elsif tg_table_name='dress_operations' then
  if tg_op='DELETE' then target:=old.dress_id;else target:=new.dress_id;end if;
  if not exists(select 1 from public.bookings b join public.synthetic_bookings s on s.booking_id=b.id where b.dress_id=target) then raise exception 'synthetic_booking_required';end if;
 else
  if tg_op='DELETE' then target:=old.booking_id;else target:=new.booking_id;end if;
  if not exists(select 1 from public.synthetic_bookings where booking_id=target) then raise exception 'synthetic_booking_required';end if;
  if tg_op='UPDATE' and not exists(select 1 from public.synthetic_bookings where booking_id=old.booking_id) then raise exception 'synthetic_booking_required';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create function public.register_portfolio_data() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.settings where id=true and synthetic_test_enabled) then
  if tg_table_name='customers' then insert into public.synthetic_customers values(new.id) on conflict do nothing;
  else insert into public.synthetic_bookings values(new.id) on conflict do nothing;end if;
 end if;
 return new;
end $$;
revoke execute on function public.enforce_portfolio_data(),public.register_portfolio_data() from public,anon,authenticated;
do $$declare tab text;begin
 foreach tab in array array['customers','bookings','payments','late_fees','handover_records','return_records','dress_operations'] loop
 execute format('create trigger portfolio_data_guard before insert or update or delete on public.%I for each row execute function public.enforce_portfolio_data()',tab);
 end loop;
end $$;
create trigger register_synthetic_customer after insert on public.customers for each row execute function public.register_portfolio_data();
create trigger register_synthetic_booking after insert on public.bookings for each row execute function public.register_portfolio_data();
insert into public.synthetic_customers(customer_id) select id from public.customers where id in ('e0000000-0000-4000-8000-000000000001'::uuid,'e0000000-0000-4000-8000-000000000002'::uuid,'e0000000-0000-4000-8000-000000000003'::uuid,'e0000000-0000-4000-8000-000000000004'::uuid,'e0000000-0000-4000-8000-000000000005'::uuid) on conflict do nothing;
insert into public.synthetic_bookings(booking_id) select id from public.bookings where id in ('b0000000-0000-4000-8000-000000000001'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'b0000000-0000-4000-8000-000000000003'::uuid,'b0000000-0000-4000-8000-000000000004'::uuid,'b0000000-0000-4000-8000-000000000005'::uuid) on conflict do nothing;

create or replace function public.get_staff_booking_config() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 return (select jsonb_build_object('live_bookings_enabled',live_bookings_enabled,'date_precision',date_precision,'business_timezone',business_timezone,'same_day_allowed',same_day_allowed,'payment_methods',payment_methods,'payment_method_optional',true,'handover_return_ready',true,'synthetic_test_enabled',synthetic_test_enabled) from public.settings where id=true);
end $$;
-- Explicitly labelled test fixtures. Never changes or deletes the retained review set.
create table public.portfolio_scenarios (
 request_id uuid primary key, booking_id uuid not null unique references public.bookings(id),
 kind text not null check(kind in ('handover','return','overdue')),
 actor_id uuid not null references public.profiles(id), assigned_to uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
alter table public.portfolio_scenarios enable row level security;
revoke all on public.portfolio_scenarios from public,anon,authenticated;
grant select on public.portfolio_scenarios to authenticated;
create policy scenario_read on public.portfolio_scenarios for select to authenticated using(public.can_access_booking(booking_id));
create function public.create_portfolio_scenario(p_request_id uuid,p_kind text,p_assigned_to uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare prior public.portfolio_scenarios; target_actor uuid;today_local date;start_day date;return_day date;d uuid;c uuid;b uuid;cat uuid;s public.settings;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_request_id is null or p_kind is null or p_kind not in ('handover','return','overdue') then raise exception 'invalid_scenario';end if;
 target_actor:=coalesce(p_assigned_to,auth.uid());
 -- Serializes scenario setup/retry and gate changes, not ordinary bookings.
 select * into s from public.settings where id=true for update;
 if not s.synthetic_test_enabled or not s.live_bookings_enabled or s.date_precision is distinct from 'day' or s.business_timezone is distinct from 'Africa/Cairo' or s.same_day_allowed is distinct from false then raise exception 'functional_portfolio_required';end if;
 select * into prior from public.portfolio_scenarios where request_id=p_request_id;
 if found then
  if prior.actor_id<>auth.uid() then raise exception 'request_id_conflict';end if;
  if prior.kind<>p_kind or prior.assigned_to<>target_actor then raise exception 'request_id_payload_mismatch';end if;
  return prior.booking_id;
 end if;
 if not exists(select 1 from public.profiles where id=target_actor and active and role in ('admin','employee')) then raise exception 'active_test_staff_required';end if;
 select id into cat from public.categories where active order by id limit 1;
 if cat is null then raise exception 'category_required';end if;
 today_local:=(now() at time zone 'Africa/Cairo')::date;
 start_day:=case p_kind when 'handover' then today_local when 'return' then today_local-1 else today_local-3 end;
 return_day:=case p_kind when 'overdue' then today_local-1 else today_local end;
 d:=gen_random_uuid();
 insert into public.dresses(id,code,name,color,size,category_id,public_availability)
 values(d,'CASE-'||replace(d::text,'-',''),'اختبار سيناريو '||p_kind||' · '||today_local::text,'وردي تجريبي','M',cat,'unavailable');
 insert into public.customers(full_name,phone) values('اختبار سيناريو '||p_kind,'TEST-SCENARIO') returning id into c;
 -- This is a fixture initializer, not a same-day booking route. Its fabricated
 -- history is labelled in the UI and isolated from the ordinary create_booking RPC.
 insert into public.bookings(request_id,dress_id,customer_id,starts_on,returns_on,agreed_price_piasters,status,created_by,assigned_to,created_at)
 values(p_request_id,d,c,start_day,return_day,10000,case p_kind when 'handover' then 'confirmed' else 'out' end,auth.uid(),target_actor,(start_day-1)::timestamp at time zone 'Africa/Cairo') returning id into b;
 insert into public.payments(request_id,booking_id,amount_piasters,method,kind,recorded_by,recorded_at)
 values(gen_random_uuid(),b,case p_kind when 'return' then 10000 else 2500 end,'مصطنع دون تحصيل','deposit',auth.uid(),(start_day-1)::timestamp at time zone 'Africa/Cairo');
 if p_kind<>'handover' then
  insert into public.handover_records(request_id,booking_id,card_received,ready_confirmed,handed_over_on,recorded_by,created_at)
  values(gen_random_uuid(),b,true,true,start_day,auth.uid(),start_day::timestamp at time zone 'Africa/Cairo');
 end if;
 insert into public.dress_operations(dress_id,status) values(d,case p_kind when 'handover' then 'in_atelier' else 'outside' end);
 insert into public.portfolio_scenarios values(p_request_id,b,p_kind,auth.uid(),target_actor,now());
 return b;
end $$;
revoke execute on function public.create_portfolio_scenario(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_portfolio_scenario(uuid,text,uuid) to authenticated;

commit;
