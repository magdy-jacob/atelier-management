begin;
-- Shared employee visibility and receipts are explicit owner choices.
-- Operational ownership and admin-only date/price/fee/cancel powers stay separate.
create function public.can_view_booking(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_staff() and exists(select 1 from public.bookings where id=p_id)
$$;
revoke execute on function public.can_view_booking(uuid) from public,anon,authenticated;
grant execute on function public.can_view_booking(uuid) to authenticated;
alter policy bookings_read on public.bookings using(public.can_view_booking(id));
alter policy customer_read on public.customers using(public.is_admin() or exists(select 1 from public.bookings b where b.customer_id=customers.id and public.can_view_booking(b.id)));
alter policy payments_read on public.payments using(public.can_view_booking(booking_id));
alter policy fees_read on public.late_fees using(public.can_view_booking(booking_id));
alter policy handover_read on public.handover_records using(public.can_view_booking(booking_id));
alter policy receipt_confirmation_read on public.receipt_confirmations using(public.can_view_booking(booking_id));
alter policy return_read on public.return_records using(public.can_view_booking(booking_id));

create or replace function public.record_booking_receipt(p_request_id uuid,p_booking_id uuid,p_amount bigint,p_method text,p_context text,p_returning boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings;prior public.payments;confirmation public.receipt_confirmations;paid bigint;fees bigint;result_id uuid;
begin
 if not public.can_view_booking(p_booking_id) then raise exception 'not_authorized' using errcode='42501';end if;
 p_method:=nullif(trim(p_method),'');
 if p_request_id is null or p_context is null or p_context not in ('deposit','return_balance') then raise exception 'invalid_receipt_context';end if;
 if p_method is not null and length(p_method)>40 then raise exception 'invalid_payment_method';end if;
 if p_context='return_balance' and p_returning is distinct from true then raise exception 'customer_return_confirmation_required';end if;
 if p_context='deposit' and p_returning is distinct from false then raise exception 'invalid_receipt_context';end if;
 select * into b from public.bookings where id=p_booking_id;
 perform 1 from public.dresses where id=b.dress_id for update;
 select * into b from public.bookings where id=p_booking_id for update;
 select * into prior from public.payments where request_id=p_request_id;
 if found then
  select * into confirmation from public.receipt_confirmations where payment_id=prior.id;
  if not found or prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  if prior.amount_piasters is distinct from p_amount or prior.method is distinct from p_method or confirmation.context<>p_context then raise exception 'request_id_payload_mismatch';end if;
  return prior.id;
 end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and date_precision='day' and business_timezone='Africa/Cairo' and same_day_allowed=false) then raise exception 'policy_decisions_pending';end if;
 select coalesce(sum(amount_piasters),0) into paid from public.payments where booking_id=p_booking_id;
 select coalesce(sum(amount_piasters),0) into fees from public.late_fees where booking_id=p_booking_id;
 if p_amount is null or p_amount<=0 or p_amount>9999999999 or paid+p_amount>b.agreed_price_piasters+fees then raise exception 'invalid_amount_or_overpayment';end if;
 if p_context='deposit' then
  if b.status<>'confirmed' or exists(select 1 from public.handover_records where booking_id=p_booking_id) then raise exception 'deposit_before_handover_only';end if;
  if paid<>0 or fees<>0 then raise exception 'deposit_already_recorded';end if;
 else
  if b.status<>'out' or exists(select 1 from public.return_records where booking_id=p_booking_id) then raise exception 'balance_at_return_only';end if;
 end if;
 insert into public.payments(request_id,booking_id,amount_piasters,method,kind,recorded_by)
 values(p_request_id,p_booking_id,p_amount,p_method,case p_context when 'deposit' then 'deposit' else 'payment' end,auth.uid()) returning id into result_id;
 insert into public.receipt_confirmations(payment_id,booking_id,request_id,context,customer_returned_on,recorded_by)
 values(result_id,p_booking_id,p_request_id,p_context,case p_context when 'return_balance' then (now() at time zone 'Africa/Cairo')::date else null end,auth.uid());
 return result_id;
end $$;

create or replace function public.get_booking_workflow(p_booking_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d uuid;result jsonb;
begin
 if not public.can_view_booking(p_booking_id) then raise exception 'not_authorized' using errcode='42501';end if;
 if not exists(select 1 from public.settings where id=true and date_precision='day' and business_timezone='Africa/Cairo') then raise exception 'confirmed_timezone_required';end if;
 select dress_id into d from public.bookings where id=p_booking_id;
 select jsonb_build_object('today',(now() at time zone 'Africa/Cairo')::date,'handover',(select to_jsonb(h) from public.handover_records h where booking_id=p_booking_id),'return',(select to_jsonb(r) from public.return_records r where booking_id=p_booking_id),'maintenance_required',coalesce((select maintenance_required or status='maintenance' from public.dress_operations where dress_id=d),false),'operation',(select status from public.dress_operations where dress_id=d),'ready_on',(select max(r.returned_on+2) from public.return_records r join public.bookings b on b.id=r.booking_id where b.dress_id=d)) into result;
 return result;
end $$;
create or replace function public.get_staff_booking_config() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 return (select jsonb_build_object('live_bookings_enabled',live_bookings_enabled,'date_precision',date_precision,'business_timezone',business_timezone,'same_day_allowed',same_day_allowed,'payment_methods',payment_methods,'payment_method_optional',true,'handover_return_ready',true,'synthetic_test_enabled',synthetic_test_enabled,'receipt_timing_ready',true,'cancellation_ready',true,'booking_edit_ready',true,'maintenance_admin_ready',true,'shared_booking_receipts_ready',true) from public.settings where id=true);
end $$;
commit;
