begin;
-- Operational confirmations only. No identity number, image, file or free-text identity field.
create table public.handover_records (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 booking_id uuid not null unique references public.bookings(id),
 card_received boolean not null check(card_received),ready_confirmed boolean not null check(ready_confirmed),
 handed_over_on date not null default ((now() at time zone 'Africa/Cairo')::date),
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.return_records (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 booking_id uuid not null unique references public.bookings(id),
 card_released boolean not null check(card_released),
 inspection text not null check(inspection in ('sound','maintenance')),
 issues text[] not null default '{}',
 returned_on date not null default ((now() at time zone 'Africa/Cairo')::date),
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 check(issues <@ array['accessories','zipper','sewing','tear']::text[]),
 check((inspection='sound' and cardinality(issues)=0) or (inspection='maintenance' and cardinality(issues) between 1 and 4))
);
alter table public.handover_records enable row level security;
alter table public.return_records enable row level security;
revoke all on public.handover_records,public.return_records from public,anon,authenticated;
grant select on public.handover_records,public.return_records to authenticated;
create policy handover_read on public.handover_records for select to authenticated using(public.can_access_booking(booking_id));
create policy return_read on public.return_records for select to authenticated using(public.can_access_booking(booking_id));
create trigger handover_audit after insert on public.handover_records for each row execute function public.audit_change();
create trigger return_audit after insert on public.return_records for each row execute function public.audit_change();

create function public.record_handover(p_request_id uuid,p_booking_id uuid,p_card_received boolean,p_ready boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings;prior public.handover_records;result_id uuid;today_local date;paid bigint;
begin
 if not public.can_access_booking(p_booking_id) then raise exception 'not_authorized' using errcode='42501';end if;
 if p_request_id is null or p_card_received is distinct from true or p_ready is distinct from true then raise exception 'handover_confirmation_required';end if;
 select * into prior from public.handover_records where request_id=p_request_id;
 if found then
  if prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  return prior.id;
 end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and date_precision='day' and business_timezone='Africa/Cairo' and same_day_allowed=false) then raise exception 'policy_decisions_pending';end if;
 select * into b from public.bookings where id=p_booking_id;
 perform 1 from public.dresses where id=b.dress_id for update;
 select * into b from public.bookings where id=p_booking_id for update;
 select * into prior from public.handover_records where request_id=p_request_id;
 if found then
  if prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  return prior.id;
 end if;
 if b.status<>'confirmed' then raise exception 'booking_not_confirmed';end if;
 today_local:=(now() at time zone 'Africa/Cairo')::date;
 if today_local<b.starts_on or today_local>b.returns_on then raise exception 'outside_planned_handover_days';end if;
 select coalesce(sum(amount_piasters),0) into paid from public.payments where booking_id=p_booking_id;
 if paid<=0 then raise exception 'deposit_required';end if;
 -- A late-return collision is a notice, never an automatic handover hold.
 -- The staff member explicitly confirms physical readiness and guarantee receipt.
 insert into public.handover_records(request_id,booking_id,card_received,ready_confirmed,recorded_by)
 values(p_request_id,p_booking_id,true,true,auth.uid()) returning id into result_id;
 update public.bookings set status='out' where id=p_booking_id;
 insert into public.dress_operations(dress_id,status) values(b.dress_id,'outside') on conflict(dress_id) do update set status='outside';
 return result_id;
end $$;

create function public.record_return(p_request_id uuid,p_booking_id uuid,p_card_released boolean,p_inspection text,p_issues text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings;prior public.return_records;result_id uuid;paid bigint;fees bigint;operation text;
begin
 if not public.can_access_booking(p_booking_id) then raise exception 'not_authorized' using errcode='42501';end if;
 if p_request_id is null or p_card_released is distinct from true then raise exception 'return_confirmation_required';end if;
 if p_inspection is null or p_inspection not in ('sound','maintenance') or p_issues is null or array_position(p_issues,null) is not null then raise exception 'invalid_inspection';end if;
 select coalesce(array_agg(v order by v),'{}'::text[]) into p_issues from (select distinct unnest(p_issues) v) x;
 if not (p_issues <@ array['accessories','zipper','sewing','tear']::text[]) or (p_inspection='sound' and cardinality(p_issues)<>0) or (p_inspection='maintenance' and cardinality(p_issues) not between 1 and 4) then raise exception 'invalid_inspection';end if;
 select * into prior from public.return_records where request_id=p_request_id;
 if found then
  if prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  if prior.inspection<>p_inspection or prior.issues<>p_issues then raise exception 'request_id_payload_mismatch';end if;
  return prior.id;
 end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and date_precision='day' and business_timezone='Africa/Cairo' and same_day_allowed=false) then raise exception 'policy_decisions_pending';end if;
 select * into b from public.bookings where id=p_booking_id;
 perform 1 from public.dresses where id=b.dress_id for update;
 select * into b from public.bookings where id=p_booking_id for update;
 select * into prior from public.return_records where request_id=p_request_id;
 if found then
  if prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  if prior.inspection<>p_inspection or prior.issues<>p_issues then raise exception 'request_id_payload_mismatch';end if;
  return prior.id;
 end if;
 if b.status<>'out' then raise exception 'booking_not_out';end if;
 select coalesce(sum(amount_piasters),0) into paid from public.payments where booking_id=p_booking_id;
 select coalesce(sum(amount_piasters),0) into fees from public.late_fees where booking_id=p_booking_id;
 if b.agreed_price_piasters+fees-paid<>0 then raise exception 'outstanding_balance_before_return';end if;
 insert into public.return_records(request_id,booking_id,card_released,inspection,issues,recorded_by)
 values(p_request_id,p_booking_id,true,p_inspection,p_issues,auth.uid()) returning id into result_id;
 update public.bookings set status='returned' where id=p_booking_id;
 operation:=case when exists(select 1 from public.bookings where dress_id=b.dress_id and status='out') then 'outside' when p_inspection='maintenance' then 'maintenance' else 'preparation' end;
 insert into public.dress_operations(dress_id,status) values(b.dress_id,operation) on conflict(dress_id) do update set status=excluded.status;
 return result_id;
end $$;

-- Readiness is a separate physical confirmation. It never cancels/moves bookings.
revoke insert,update,delete on public.dress_operations from public,anon,authenticated;
create or replace function public.set_dress_operation(p_dress_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare today_local date;
begin
 if not public.is_staff() or not (public.is_admin() or exists(select 1 from public.bookings where dress_id=p_dress_id and public.can_access_booking(id))) then raise exception 'not_authorized' using errcode='42501';end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and date_precision='day' and business_timezone='Africa/Cairo') then raise exception 'policy_decisions_pending';end if;
 if p_status is null or p_status not in ('in_atelier','preparation','maintenance') then raise exception 'invalid_state';end if;
 perform 1 from public.dresses where id=p_dress_id for update;
 if not found then raise exception 'dress_not_found';end if;
 if exists(select 1 from public.bookings where dress_id=p_dress_id and status='out') then raise exception 'return_workflow_required';end if;
 today_local:=(now() at time zone 'Africa/Cairo')::date;
 if p_status='in_atelier' and exists(select 1 from public.return_records r join public.bookings b on b.id=r.booking_id where b.dress_id=p_dress_id and r.returned_on+2>today_local) then raise exception 'preparation_day_not_finished';end if;
 insert into public.dress_operations(dress_id,status) values(p_dress_id,p_status) on conflict(dress_id) do update set status=excluded.status where public.dress_operations.status is distinct from excluded.status;
end $$;
create function public.get_booking_workflow(p_booking_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d uuid;result jsonb;
begin
 if not public.can_access_booking(p_booking_id) then raise exception 'not_authorized' using errcode='42501';end if;
 if not exists(select 1 from public.settings where id=true and date_precision='day' and business_timezone='Africa/Cairo') then raise exception 'confirmed_timezone_required';end if;
 select dress_id into d from public.bookings where id=p_booking_id;
 select jsonb_build_object('today',(now() at time zone 'Africa/Cairo')::date,'handover',(select to_jsonb(h) from public.handover_records h where booking_id=p_booking_id),'return',(select to_jsonb(r) from public.return_records r where booking_id=p_booking_id),'operation',(select status from public.dress_operations where dress_id=d),'ready_on',(select max(r.returned_on+2) from public.return_records r join public.bookings b on b.id=r.booking_id where b.dress_id=d)) into result;
 return result;
end $$;
revoke execute on function public.get_booking_workflow(uuid) from public,anon,authenticated;
grant execute on function public.get_booking_workflow(uuid) to authenticated;
create or replace function public.get_staff_booking_config() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 return (select jsonb_build_object('live_bookings_enabled',live_bookings_enabled,'date_precision',date_precision,'business_timezone',business_timezone,'same_day_allowed',same_day_allowed,'payment_methods',payment_methods,'payment_method_optional',true,'handover_return_ready',true) from public.settings where id=true);
end $$;
revoke execute on function public.record_handover(uuid,uuid,boolean,boolean),public.record_return(uuid,uuid,boolean,text,text[]),public.set_dress_operation(uuid,text),public.get_staff_booking_config() from public,anon,authenticated;
grant execute on function public.record_handover(uuid,uuid,boolean,boolean),public.record_return(uuid,uuid,boolean,text,text[]),public.set_dress_operation(uuid,text),public.get_staff_booking_config() to authenticated;

-- Actual return preparation constrains NEW booking creation, not handover of existing bookings.
create or replace function public.create_booking(p_request_id uuid,p_dress_id uuid,p_customer_name text,p_phone text,p_start date,p_return date,p_total bigint,p_deposit bigint,p_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.settings; booking_id uuid; customer_id uuid; prior public.bookings; local_today date;
begin
 p_method:=nullif(trim(p_method),'');
 if p_method is not null and length(p_method)>40 then raise exception 'invalid_payment_method';end if;
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 select * into prior from public.bookings where request_id=p_request_id;
 if found then
  if prior.created_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  if prior.dress_id is distinct from p_dress_id or prior.starts_on is distinct from p_start or prior.returns_on is distinct from p_return or prior.agreed_price_piasters is distinct from p_total
     or not exists(select 1 from public.customers where id=prior.customer_id and full_name=trim(p_customer_name) and phone=trim(p_phone))
     or coalesce((select amount_piasters from public.payments pay where pay.request_id=p_request_id and pay.booking_id=prior.id and pay.kind='deposit'),0) is distinct from p_deposit
     or (p_deposit>0 and (select method from public.payments pay where pay.request_id=p_request_id and pay.booking_id=prior.id and pay.kind='deposit') is distinct from p_method)
  then raise exception 'request_id_payload_mismatch';end if;
  return prior.id;
 end if;
 select * into s from public.settings where id=true;
 if not s.live_bookings_enabled or s.date_precision is distinct from 'day' or s.same_day_allowed is null or s.business_timezone is null then raise exception 'policy_decisions_pending';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=s.business_timezone) then raise exception 'invalid_timezone';end if;
 local_today:=(now() at time zone s.business_timezone)::date;
 if p_start is null or p_return is null or p_start<local_today or p_return<p_start or (p_start=local_today and not s.same_day_allowed) then raise exception 'invalid_dates_or_same_day_policy';end if;
 if p_total is null or p_deposit is null or p_total<=0 or p_total>9999999999 or p_deposit<0 or p_deposit>p_total then raise exception 'invalid_amount';end if;
 if p_customer_name is null or length(trim(p_customer_name)) not between 1 and 120 or p_phone is null or length(trim(p_phone)) not between 5 and 24 then raise exception 'invalid_customer';end if;
 if p_method is not null and length(p_method)>40 then raise exception 'invalid_payment_method';end if;
 -- Row lock also serializes against archiving and concurrent booking mutations.
 perform 1 from public.dresses where id=p_dress_id and not archived for update;
 if not found then raise exception 'dress_not_found';end if;
 if exists(select 1 from public.dress_operations where dress_id=p_dress_id and status in ('outside','maintenance')) then raise exception 'dress_operationally_unavailable';end if;
 if exists(select 1 from public.return_records r join public.bookings b on b.id=r.booking_id where b.dress_id=p_dress_id and p_start<r.returned_on+2) then raise exception 'actual_preparation_conflict' using errcode='23P01';end if;
 insert into public.customers(full_name,phone) values(trim(p_customer_name),trim(p_phone)) returning id into customer_id;
 insert into public.bookings(request_id,dress_id,customer_id,starts_on,returns_on,agreed_price_piasters,created_by,assigned_to)
 values(p_request_id,p_dress_id,customer_id,p_start,p_return,p_total,auth.uid(),auth.uid()) returning id into booking_id;
 if p_deposit>0 then insert into public.payments(request_id,booking_id,amount_piasters,method,kind,recorded_by) values(p_request_id,booking_id,p_deposit,p_method,'deposit',auth.uid());end if;
 return booking_id;
end $$;

create or replace function public.next_available_day(p_dress_id uuid,p_start date,p_duration integer) returns date language plpgsql stable security definer set search_path='' as $$
declare candidate date:=p_start;blocked_until date;steps integer:=0;max_steps integer;
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_start is null or p_duration is null or p_duration<0 then raise exception 'invalid_dates';end if;
 if not exists(select 1 from public.dresses where id=p_dress_id and not archived) then raise exception 'dress_not_found';end if;
 select greatest(candidate,coalesce(max(r.returned_on+2),candidate)) into candidate from public.return_records r join public.bookings b on b.id=r.booking_id where b.dress_id=p_dress_id;
 select count(*)+1 into max_steps from public.bookings where dress_id=p_dress_id and status<>'cancelled';
 loop
  select min(upper(occupied)) into blocked_until from public.bookings
   where dress_id=p_dress_id and status<>'cancelled' and occupied && daterange(candidate,candidate+p_duration+2,'[)');
  if blocked_until is null then return candidate;end if;
  candidate:=blocked_until;steps:=steps+1;
  if steps>max_steps then raise exception 'availability_search_failed';end if;
 end loop;
end $$;

-- Keep the critical preparation impact visible after a recorded late return.
create or replace function public.get_admin_notifications(p_kind text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today_local date;zone text;result jsonb;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 select business_timezone into zone from public.settings where id=true and date_precision='day';
 if zone is distinct from 'Africa/Cairo' then raise exception 'confirmed_timezone_required';end if;
 if p_kind is not null and p_kind not in ('outgoing','incoming','overdue','collision') then raise exception 'invalid_notification_type';end if;
 today_local:=(now() at time zone zone)::date;
 with alerts as (
 select b.id booking_id,'outgoing'::text kind,b.starts_on-1 event_on,b.starts_on,b.returns_on,d.name dress_name,c.full_name customer_name,null::uuid related_booking_id,null::date related_starts_on,null::date actual_returned_on from public.bookings b join public.dresses d on d.id=b.dress_id join public.customers c on c.id=b.customer_id where b.status='confirmed' and b.starts_on<=today_local+1
 union all
 select b.id,'incoming',b.returns_on,b.starts_on,b.returns_on,d.name,c.full_name,null::uuid,null::date,null::date from public.bookings b join public.dresses d on d.id=b.dress_id join public.customers c on c.id=b.customer_id where b.status='out' and b.returns_on=today_local
 union all
 select b.id,'overdue',b.returns_on+1,b.starts_on,b.returns_on,d.name,c.full_name,null::uuid,null::date,null::date from public.bookings b join public.dresses d on d.id=b.dress_id join public.customers c on c.id=b.customer_id where b.status='out' and b.returns_on<today_local
 union all
 select b.id,'collision',n.starts_on-1,b.starts_on,b.returns_on,d.name,c.full_name,n.id,n.starts_on,r.returned_on
 from public.bookings b join public.dresses d on d.id=b.dress_id join public.customers c on c.id=b.customer_id left join public.return_records r on r.booking_id=b.id
 join lateral(select next.id,next.starts_on from public.bookings next where next.dress_id=b.dress_id and next.id<>b.id and next.status in ('confirmed','out') and next.starts_on>b.returns_on and next.starts_on<(case when b.status='out' then today_local+2 else r.returned_on+2 end) order by next.starts_on,next.id limit 1)n on true
 where (b.status='out' and b.returns_on<today_local) or (b.status='returned' and r.returned_on>b.returns_on and today_local<r.returned_on+2)
 ), marked as (
 select a.*,r.read_at from alerts a left join public.notification_reads r on r.user_id=auth.uid() and r.booking_id=a.booking_id and r.kind=a.kind and r.event_on=a.event_on where p_kind is null or a.kind=p_kind
 ), limited as (
 select * from marked order by case kind when 'collision' then 0 when 'overdue' then 1 when 'incoming' then 2 else 3 end,event_on,booking_id limit 1000
 )
 select jsonb_build_object('today',today_local,'total',(select count(*) from marked),'items',coalesce((select jsonb_agg(to_jsonb(l) order by case l.kind when 'collision' then 0 when 'overdue' then 1 when 'incoming' then 2 else 3 end,l.event_on,l.booking_id) from limited l),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function public.mark_notification_read(p_booking_id uuid,p_kind text,p_event_on date) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;today_local date;zone text;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('outgoing','incoming','overdue','collision') or p_event_on is null then raise exception 'invalid_notification';end if;
 select business_timezone into zone from public.settings where id=true and date_precision='day';
 if zone is distinct from 'Africa/Cairo' then raise exception 'confirmed_timezone_required';end if;
 today_local:=(now() at time zone zone)::date;
 select * into b from public.bookings where id=p_booking_id for share;
 if not found then raise exception 'invalid_notification';end if;
 if not (
  (p_kind='outgoing' and b.status='confirmed' and b.starts_on<=today_local+1 and p_event_on=b.starts_on-1)
  or (p_kind='incoming' and b.status='out' and b.returns_on=today_local and p_event_on=b.returns_on)
  or (p_kind='overdue' and b.status='out' and b.returns_on<today_local and p_event_on=b.returns_on+1)
  or (p_kind='collision' and exists(select 1 from public.bookings n left join public.return_records r on r.booking_id=b.id where n.dress_id=b.dress_id and n.id<>b.id and n.status in ('confirmed','out') and n.starts_on>b.returns_on and p_event_on=n.starts_on-1 and ((b.status='out' and b.returns_on<today_local and n.starts_on<today_local+2) or (b.status='returned' and r.returned_on>b.returns_on and today_local<r.returned_on+2 and n.starts_on<r.returned_on+2))))
 ) then raise exception 'notification_not_active';end if;
 insert into public.notification_reads(user_id,booking_id,kind,event_on) values(auth.uid(),p_booking_id,p_kind,p_event_on) on conflict do nothing;
end $$;
revoke execute on function public.get_admin_notifications(text),public.mark_notification_read(uuid,text,date) from public,anon,authenticated;
grant execute on function public.get_admin_notifications(text),public.mark_notification_read(uuid,text,date) to authenticated;

commit;
