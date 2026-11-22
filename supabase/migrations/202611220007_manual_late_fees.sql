begin;
alter table public.late_fees add column request_id uuid not null default gen_random_uuid();
alter table public.late_fees add constraint late_fees_request_id_key unique(request_id);
revoke insert,update,delete on public.late_fees from public,anon,authenticated;
drop policy if exists fees_insert on public.late_fees;
create function public.add_late_fee(p_request_id uuid,p_booking_id uuid,p_amount bigint,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings;prior public.late_fees;fee_id uuid;today_local date;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 p_reason:=trim(p_reason);
 select * into prior from public.late_fees where request_id=p_request_id;
 if found then
  if prior.recorded_by<>auth.uid() or prior.booking_id is distinct from p_booking_id then raise exception 'request_id_conflict';end if;
  if prior.amount_piasters is distinct from p_amount or prior.reason is distinct from p_reason then raise exception 'request_id_payload_mismatch';end if;
  return prior.id;
 end if;
 if not exists(select 1 from public.settings where id=true and live_bookings_enabled and date_precision='day' and business_timezone='Africa/Cairo') then raise exception 'policy_decisions_pending';end if;
 if p_request_id is null or p_amount is null or p_amount<=0 or p_amount>9999999999 or p_reason is null or length(p_reason) not between 1 and 500 then raise exception 'invalid_fee';end if;
 today_local:=(now() at time zone 'Africa/Cairo')::date;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'booking_not_found';end if;
 select * into prior from public.late_fees where request_id=p_request_id;
 if found then
  if prior.recorded_by<>auth.uid() or prior.booking_id is distinct from p_booking_id then raise exception 'request_id_conflict';end if;
  if prior.amount_piasters is distinct from p_amount or prior.reason is distinct from p_reason then raise exception 'request_id_payload_mismatch';end if;
  return prior.id;
 end if;
 if b.status<>'out' or b.returns_on>=today_local then raise exception 'booking_not_currently_overdue';end if;
 insert into public.late_fees(request_id,booking_id,amount_piasters,reason,recorded_by) values(p_request_id,p_booking_id,p_amount,p_reason,auth.uid()) returning id into fee_id;
 return fee_id;
end $$;
revoke execute on function public.add_late_fee(uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.add_late_fee(uuid,uuid,bigint,text) to authenticated;
commit;
