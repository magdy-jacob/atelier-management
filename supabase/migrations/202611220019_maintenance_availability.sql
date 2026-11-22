begin;
-- A maintenance requirement is separate from physical outside/preparation state.
-- Existing status=maintenance is treated as held without rewriting old rows.
-- Later sound returns cannot erase a new unresolved maintenance requirement.
alter table public.dress_operations add column maintenance_required boolean not null default false;
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
 if exists(select 1 from public.dress_operations where dress_id=p_dress_id and (status='maintenance' or maintenance_required)) then raise exception 'dress_in_maintenance';end if;
 if exists(select 1 from public.return_records r join public.bookings b on b.id=r.booking_id where b.dress_id=p_dress_id and p_start<r.returned_on+2) then raise exception 'actual_preparation_conflict' using errcode='23P01';end if;
 insert into public.customers(full_name,phone) values(trim(p_customer_name),trim(p_phone)) returning id into customer_id;
 insert into public.bookings(request_id,dress_id,customer_id,starts_on,returns_on,agreed_price_piasters,created_by,assigned_to)
 values(p_request_id,p_dress_id,customer_id,p_start,p_return,p_total,auth.uid(),auth.uid()) returning id into booking_id;
 if p_deposit>0 then insert into public.payments(request_id,booking_id,amount_piasters,method,kind,recorded_by) values(p_request_id,booking_id,p_deposit,p_method,'deposit',auth.uid());end if;
 return booking_id;
end $$;

create or replace function public.record_handover(p_request_id uuid,p_booking_id uuid,p_card_received boolean,p_ready boolean) returns uuid language plpgsql security definer set search_path='' as $$
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
 if exists(select 1 from public.dress_operations where dress_id=b.dress_id and (status='maintenance' or maintenance_required)) then raise exception 'maintenance_admin_clear_required';end if;
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

create or replace function public.record_return(p_request_id uuid,p_booking_id uuid,p_card_released boolean,p_inspection text,p_issues text[]) returns uuid language plpgsql security definer set search_path='' as $$
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
 insert into public.dress_operations(dress_id,status,maintenance_required) values(b.dress_id,operation,p_inspection='maintenance') on conflict(dress_id) do update set status=excluded.status,maintenance_required=public.dress_operations.maintenance_required or public.dress_operations.status='maintenance' or excluded.maintenance_required;
 return result_id;
end $$;

create or replace function public.set_dress_operation(p_dress_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare today_local date;held boolean;next_hold boolean;
begin
 if not public.is_staff() or not (public.is_admin() or exists(select 1 from public.bookings where dress_id=p_dress_id and public.can_access_booking(id))) then raise exception 'not_authorized' using errcode='42501';end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and date_precision='day' and business_timezone='Africa/Cairo') then raise exception 'policy_decisions_pending';end if;
 if p_status is null or p_status not in ('in_atelier','preparation','maintenance') then raise exception 'invalid_state';end if;
 perform 1 from public.dresses where id=p_dress_id for update;
 if not found then raise exception 'dress_not_found';end if;
 if exists(select 1 from public.bookings where dress_id=p_dress_id and status='out') then raise exception 'return_workflow_required';end if;
 select coalesce((select maintenance_required or status='maintenance' from public.dress_operations where dress_id=p_dress_id),false) into held;
 if held and p_status<>'maintenance' and not public.is_admin() then raise exception 'maintenance_admin_clear_required';end if;
 next_hold:=case when p_status='maintenance' then true when p_status='in_atelier' and public.is_admin() then false else held end;
 today_local:=(now() at time zone 'Africa/Cairo')::date;
 if p_status='in_atelier' and exists(select 1 from public.return_records r join public.bookings b on b.id=r.booking_id where b.dress_id=p_dress_id and r.returned_on+2>today_local) then raise exception 'preparation_day_not_finished';end if;
 insert into public.dress_operations(dress_id,status,maintenance_required) values(p_dress_id,p_status,next_hold) on conflict(dress_id) do update set status=excluded.status,maintenance_required=excluded.maintenance_required where public.dress_operations.status is distinct from excluded.status or public.dress_operations.maintenance_required is distinct from excluded.maintenance_required;
end $$;

create or replace function public.get_booking_workflow(p_booking_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d uuid;result jsonb;
begin
 if not public.can_access_booking(p_booking_id) then raise exception 'not_authorized' using errcode='42501';end if;
 if not exists(select 1 from public.settings where id=true and date_precision='day' and business_timezone='Africa/Cairo') then raise exception 'confirmed_timezone_required';end if;
 select dress_id into d from public.bookings where id=p_booking_id;
 select jsonb_build_object('today',(now() at time zone 'Africa/Cairo')::date,'handover',(select to_jsonb(h) from public.handover_records h where booking_id=p_booking_id),'return',(select to_jsonb(r) from public.return_records r where booking_id=p_booking_id),'maintenance_required',coalesce((select maintenance_required or status='maintenance' from public.dress_operations where dress_id=d),false),'operation',(select status from public.dress_operations where dress_id=d),'ready_on',(select max(r.returned_on+2) from public.return_records r join public.bookings b on b.id=r.booking_id where b.dress_id=d)) into result;
 return result;
end $$;

create or replace function public.edit_booking(p_request_id uuid,p_booking_id uuid,p_expected_version integer,p_start date,p_return date,p_total bigint,p_reason text,p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings;prior public.booking_changes;paid numeric;after_v integer;change_id uuid;dates_changed boolean;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 p_reason:=trim(p_reason);
 if p_request_id is null or p_expected_version is null or p_expected_version<1 or p_reason is null or length(p_reason) not between 1 and 500 or p_confirm is distinct from true then raise exception 'booking_edit_confirmation_required';end if;
 if p_start is null or p_return is null or p_return<p_start then raise exception 'invalid_booking_edit_dates';end if;
 if p_total is null or p_total<=0 or p_total>9999999999 then raise exception 'invalid_booking_edit_amount';end if;
 select * into b from public.bookings where id=p_booking_id;
 if not found then raise exception 'booking_not_found';end if;
 -- Same lock order as receipts, handover, return and cancellation.
 perform 1 from public.dresses where id=b.dress_id for update;
 select * into b from public.bookings where id=p_booking_id for update;
 select * into prior from public.booking_changes where request_id=p_request_id;
 if found then
  if prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  if prior.before_version<>p_expected_version or prior.new_start<>p_start or prior.new_return<>p_return or prior.new_price_piasters<>p_total or prior.reason<>p_reason then raise exception 'request_id_payload_mismatch';end if;
  return jsonb_build_object('version',prior.after_version,'unchanged',false,'change_id',prior.id);
 end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and date_precision='day' and business_timezone='Africa/Cairo' and same_day_allowed=false) then raise exception 'policy_decisions_pending';end if;
 if b.status<>'confirmed' or exists(select 1 from public.handover_records where booking_id=b.id) or exists(select 1 from public.return_records where booking_id=b.id) then raise exception 'booking_edit_before_handover_only';end if;
 if b.version<>p_expected_version then raise exception 'stale_booking_version' using errcode='40001';end if;
 dates_changed:=p_start<>b.starts_on or p_return<>b.returns_on;
 if not dates_changed and p_total=b.agreed_price_piasters then return jsonb_build_object('version',b.version,'unchanged',true,'change_id',null);end if;
 -- Retaining an existing today's scenario date for price-only edits is not a
 -- new same-day booking. A date change must keep the one-day advance policy.
 if dates_changed and exists(select 1 from public.dress_operations where dress_id=b.dress_id and (status='maintenance' or maintenance_required)) then raise exception 'dress_in_maintenance';end if;
 if dates_changed and p_start<=(now() at time zone 'Africa/Cairo')::date then raise exception 'booking_edit_advance_required';end if;
 if dates_changed and exists(select 1 from public.return_records r join public.bookings previous on previous.id=r.booking_id where previous.dress_id=b.dress_id and p_start<r.returned_on+2) then raise exception 'actual_preparation_conflict' using errcode='23P01';end if;
 select coalesce(sum(amount_piasters),0) into paid from public.payments where booking_id=b.id;
 if p_total<paid then raise exception 'booking_price_below_receipts';end if;
 update public.bookings set starts_on=p_start,returns_on=p_return,agreed_price_piasters=p_total where id=b.id returning version into after_v;
 -- The existing exclusion constraint prevents overlap, including the complete
 -- preparation day. Any failed update rolls back the history as one transaction.
 insert into public.booking_changes(request_id,booking_id,recorded_by,reason,old_start,old_return,new_start,new_return,old_price_piasters,new_price_piasters,before_version,after_version)
 values(p_request_id,b.id,auth.uid(),p_reason,b.starts_on,b.returns_on,p_start,p_return,b.agreed_price_piasters,p_total,b.version,after_v) returning id into change_id;
 return jsonb_build_object('version',after_v,'unchanged',false,'change_id',change_id);
end $$;

create or replace function public.get_staff_booking_config() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 return (select jsonb_build_object('live_bookings_enabled',live_bookings_enabled,'date_precision',date_precision,'business_timezone',business_timezone,'same_day_allowed',same_day_allowed,'payment_methods',payment_methods,'payment_method_optional',true,'handover_return_ready',true,'synthetic_test_enabled',synthetic_test_enabled,'receipt_timing_ready',true,'cancellation_ready',true,'booking_edit_ready',true,'maintenance_admin_ready',true) from public.settings where id=true);
end $$;

create or replace function public.next_available_day(p_dress_id uuid,p_start date,p_duration integer) returns date language plpgsql stable security definer set search_path='' as $$
declare candidate date:=p_start;blocked_until date;steps integer:=0;max_steps integer;
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_start is null or p_duration is null or p_duration<0 then raise exception 'invalid_dates';end if;
 if not exists(select 1 from public.dresses where id=p_dress_id and not archived) then raise exception 'dress_not_found';end if;
 if exists(select 1 from public.dress_operations where dress_id=p_dress_id and (status='maintenance' or maintenance_required)) then raise exception 'dress_in_maintenance';end if;
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
commit;
