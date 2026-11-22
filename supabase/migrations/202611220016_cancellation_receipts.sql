begin;
-- Narrow receipt timing: initial deposit, or balance while the customer is returning.
-- Existing receipts are immutable history, not retroactively reclassified.
create table public.receipt_confirmations (
 payment_id uuid primary key references public.payments(id),
 booking_id uuid not null references public.bookings(id),
 request_id uuid not null unique,
 context text not null check(context in ('deposit','return_balance')),
 customer_returned_on date,
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 check((context='deposit' and customer_returned_on is null) or (context='return_balance' and customer_returned_on is not null))
);
alter table public.receipt_confirmations enable row level security;
revoke all on public.receipt_confirmations from public,anon,authenticated;
grant select on public.receipt_confirmations to authenticated;
create policy receipt_confirmation_read on public.receipt_confirmations for select to authenticated using(public.can_access_booking(booking_id));
create trigger receipt_confirmation_guard before insert or update or delete on public.receipt_confirmations for each row execute function public.enforce_portfolio_data();
create trigger receipt_confirmation_audit after insert on public.receipt_confirmations for each row execute function public.audit_change();
-- The previous general-purpose receipt RPC is retained privately for history,
-- but application tokens cannot use it to bypass the new timing checks.
revoke execute on function public.record_payment(uuid,uuid,bigint,text) from public,anon,authenticated;
create function public.record_booking_receipt(p_request_id uuid,p_booking_id uuid,p_amount bigint,p_method text,p_context text,p_returning boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings;prior public.payments;confirmation public.receipt_confirmations;paid bigint;fees bigint;result_id uuid;
begin
 if not public.can_access_booking(p_booking_id) then raise exception 'not_authorized' using errcode='42501';end if;
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
revoke execute on function public.record_booking_receipt(uuid,uuid,bigint,text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_booking_receipt(uuid,uuid,bigint,text,text,boolean) to authenticated;

create table public.booking_cancellations (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 booking_id uuid not null unique references public.bookings(id),
 reason text not null check(length(reason) between 1 and 500),
 retained_deposit_piasters bigint not null check(retained_deposit_piasters>=0),
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
alter table public.booking_cancellations enable row level security;
revoke all on public.booking_cancellations from public,anon,authenticated;
grant select on public.booking_cancellations to authenticated;
create policy cancellation_read on public.booking_cancellations for select to authenticated using(public.can_access_booking(booking_id));
create trigger cancellation_guard before insert or update or delete on public.booking_cancellations for each row execute function public.enforce_portfolio_data();
create trigger cancellation_audit after insert on public.booking_cancellations for each row execute function public.audit_change();
create function public.cancel_booking(p_request_id uuid,p_booking_id uuid,p_reason text,p_confirm_nonrefundable boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings;prior public.booking_cancellations;deposits bigint;extra bigint;fees bigint;result_id uuid;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 p_reason:=trim(p_reason);
 if p_request_id is null or p_reason is null or length(p_reason) not between 1 and 500 or p_confirm_nonrefundable is distinct from true then raise exception 'cancellation_confirmation_required';end if;
 select * into b from public.bookings where id=p_booking_id;
 if not found then raise exception 'booking_not_found';end if;
 perform 1 from public.dresses where id=b.dress_id for update;
 select * into b from public.bookings where id=p_booking_id for update;
 select * into prior from public.booking_cancellations where request_id=p_request_id;
 if found then
  if prior.booking_id<>p_booking_id or prior.recorded_by<>auth.uid() then raise exception 'request_id_conflict';end if;
  if prior.reason<>p_reason then raise exception 'request_id_payload_mismatch';end if;
  return prior.id;
 end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and date_precision='day' and business_timezone='Africa/Cairo' and same_day_allowed=false) then raise exception 'policy_decisions_pending';end if;
 if b.status<>'confirmed' or exists(select 1 from public.handover_records where booking_id=p_booking_id) or exists(select 1 from public.return_records where booking_id=p_booking_id) then raise exception 'cancellation_before_handover_only';end if;
 select coalesce(sum(amount_piasters) filter(where kind='deposit'),0),coalesce(sum(amount_piasters) filter(where kind<>'deposit'),0) into deposits,extra from public.payments where booking_id=p_booking_id;
 select coalesce(sum(amount_piasters),0) into fees from public.late_fees where booking_id=p_booking_id;
 -- Unexpected historic extra receipts/fees require an admin exception policy,
 -- never a guessed refund, deleted payment or changed historical amount.
 if extra<>0 or fees<>0 then raise exception 'financial_exception_requires_admin_review';end if;
 insert into public.booking_cancellations(request_id,booking_id,reason,retained_deposit_piasters,recorded_by)
 values(p_request_id,p_booking_id,p_reason,deposits,auth.uid()) returning id into result_id;
 update public.bookings set status='cancelled' where id=p_booking_id;
 return result_id;
end $$;
revoke execute on function public.cancel_booking(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.cancel_booking(uuid,uuid,text,boolean) to authenticated;
create or replace function public.get_staff_booking_config() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 return (select jsonb_build_object('live_bookings_enabled',live_bookings_enabled,'date_precision',date_precision,'business_timezone',business_timezone,'same_day_allowed',same_day_allowed,'payment_methods',payment_methods,'payment_method_optional',true,'handover_return_ready',true,'synthetic_test_enabled',synthetic_test_enabled,'receipt_timing_ready',true,'cancellation_ready',true) from public.settings where id=true);
end $$;
commit;
