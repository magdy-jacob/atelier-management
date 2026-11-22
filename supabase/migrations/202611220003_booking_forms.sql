begin;
-- Day-only granularity confirmed by the owner on 22 November 2026.
-- Advance booking of at least one calendar day was also confirmed.
-- Egypt calendar-day boundaries confirmed explicitly. Payment methods remain pending.
-- This does not enable bookings.
update public.settings set date_precision='day',same_day_allowed=false,business_timezone='Africa/Cairo' where id=true;
create function public.get_staff_booking_config() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 return (select jsonb_build_object('live_bookings_enabled',live_bookings_enabled,'date_precision',date_precision,'business_timezone',business_timezone,'same_day_allowed',same_day_allowed,'payment_methods',payment_methods) from public.settings where id=true);
end $$;
create function public.next_available_day(p_dress_id uuid,p_start date,p_duration integer) returns date language plpgsql stable security definer set search_path='' as $$
declare candidate date:=p_start;blocked_until date;steps integer:=0;max_steps integer;
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_start is null or p_duration is null or p_duration<0 then raise exception 'invalid_dates';end if;
 if not exists(select 1 from public.dresses where id=p_dress_id and not archived) then raise exception 'dress_not_found';end if;
 select count(*)+1 into max_steps from public.bookings where dress_id=p_dress_id and status<>'cancelled';
 loop
  select min(upper(occupied)) into blocked_until from public.bookings
   where dress_id=p_dress_id and status<>'cancelled' and occupied && daterange(candidate,candidate+p_duration+2,'[)');
  if blocked_until is null then return candidate;end if;
  candidate:=blocked_until;steps:=steps+1;
  if steps>max_steps then raise exception 'availability_search_failed';end if;
 end loop;
end $$;
create or replace function public.create_booking(p_request_id uuid,p_dress_id uuid,p_customer_name text,p_phone text,p_start date,p_return date,p_total bigint,p_deposit bigint,p_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.settings; booking_id uuid; customer_id uuid; prior public.bookings; local_today date;
begin
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

create or replace function public.record_payment(p_request_id uuid,p_booking_id uuid,p_amount bigint,p_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings; paid bigint; fees bigint; payment_id uuid; prior public.payments;
begin
 if not public.can_access_booking(p_booking_id) then raise exception 'not_authorized' using errcode='42501';end if;
 select * into prior from public.payments where request_id=p_request_id;
 if found then
  if prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  if prior.kind<>'payment' or prior.amount_piasters is distinct from p_amount or prior.method is distinct from p_method then raise exception 'request_id_payload_mismatch';end if;
  return prior.id;
 end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and p_method=any(payment_methods)) then raise exception 'policy_decisions_pending';end if;
 select * into b from public.bookings where id=p_booking_id for update;
 select * into prior from public.payments where request_id=p_request_id;
 if found then
  if prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  if prior.kind<>'payment' or prior.amount_piasters is distinct from p_amount or prior.method is distinct from p_method then raise exception 'request_id_payload_mismatch';end if;
  return prior.id;
 end if;
 if b.status not in ('confirmed','out') then raise exception 'booking_not_payable';end if;
 select coalesce(sum(amount_piasters),0) into paid from public.payments where booking_id=p_booking_id;
 select coalesce(sum(amount_piasters),0) into fees from public.late_fees where booking_id=p_booking_id;
 if p_amount is null or p_amount<=0 or p_amount>9999999999 or paid+p_amount>b.agreed_price_piasters+fees then raise exception 'invalid_amount_or_overpayment';end if;
 insert into public.payments(request_id,booking_id,amount_piasters,method,kind,recorded_by) values(p_request_id,p_booking_id,p_amount,p_method,'payment',auth.uid()) returning id into payment_id;
 return payment_id;
end $$;

revoke execute on function public.get_staff_booking_config(),public.next_available_day(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.get_staff_booking_config(),public.next_available_day(uuid,date,integer) to authenticated;
commit;
