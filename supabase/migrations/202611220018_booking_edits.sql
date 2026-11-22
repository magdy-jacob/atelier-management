begin;
alter table public.bookings add column version integer not null default 1 check(version>0);
create function public.bump_booking_version() returns trigger language plpgsql set search_path='' as $$begin new.version:=old.version+1;return new;end $$;
create trigger booking_version before update on public.bookings for each row execute function public.bump_booking_version();
revoke execute on function public.bump_booking_version() from public,anon,authenticated;
create table public.booking_changes (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 booking_id uuid not null references public.bookings(id),recorded_by uuid not null references public.profiles(id),
 reason text not null check(length(reason) between 1 and 500),
 old_start date not null,old_return date not null,new_start date not null,new_return date not null,
 old_price_piasters bigint not null,new_price_piasters bigint not null,
 before_version integer not null,after_version integer not null check(after_version=before_version+1),
 created_at timestamptz not null default now(),check(old_return>=old_start),check(new_return>=new_start)
);
alter table public.booking_changes enable row level security;
revoke all on public.booking_changes from public,anon,authenticated;
grant select on public.booking_changes to authenticated;
create policy booking_changes_admin_read on public.booking_changes for select to authenticated using(public.is_admin());
create trigger booking_changes_guard before insert or update or delete on public.booking_changes for each row execute function public.enforce_portfolio_data();
create trigger booking_changes_audit after insert on public.booking_changes for each row execute function public.audit_change();
create function public.edit_booking(p_request_id uuid,p_booking_id uuid,p_expected_version integer,p_start date,p_return date,p_total bigint,p_reason text,p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
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
revoke execute on function public.edit_booking(uuid,uuid,integer,date,date,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.edit_booking(uuid,uuid,integer,date,date,bigint,text,boolean) to authenticated;
create or replace function public.get_staff_booking_config() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'not_authorized' using errcode='42501';end if;
 return (select jsonb_build_object('live_bookings_enabled',live_bookings_enabled,'date_precision',date_precision,'business_timezone',business_timezone,'same_day_allowed',same_day_allowed,'payment_methods',payment_methods,'payment_method_optional',true,'handover_return_ready',true,'synthetic_test_enabled',synthetic_test_enabled,'receipt_timing_ready',true,'cancellation_ready',true,'booking_edit_ready',true) from public.settings where id=true);
end $$;
commit;
