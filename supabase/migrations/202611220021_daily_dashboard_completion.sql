begin;
-- Extend the same stable admin-only aggregate, one snapshot and no new writes.
-- Public labels are manual metadata, not a date-specific availability promise.
create or replace function public.admin_dashboard(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare zone text;today_local date;from_instant timestamptz;until_instant timestamptz;result jsonb;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'invalid_reporting_period';end if;
 select business_timezone into zone from public.settings where id=true and date_precision='day';
 if zone is distinct from 'Africa/Cairo' then raise exception 'confirmed_timezone_required';end if;
 today_local:=(now() at time zone zone)::date;
 from_instant:=p_from::timestamp at time zone zone;
 until_instant:=(p_to+1)::timestamp at time zone zone;
 select jsonb_build_object(
  'from',p_from,'to',p_to,'today',today_local,
  'active_dresses',(select count(*) from public.dresses where not archived),
  'public_available_dresses',(select count(*) from public.dresses where not archived and public_availability='available'),
  'public_reserved_dresses',(select count(*) from public.dresses where not archived and public_availability='reserved'),
  'public_unavailable_dresses',(select count(*) from public.dresses where not archived and public_availability='unavailable'),
  'archived_dresses',(select count(*) from public.dresses where archived),
  'active_employees',(select count(*) from public.profiles where active and role='employee'),
  'confirmed_bookings',(select count(*) from public.bookings where status='confirmed'),
  'outside_bookings',(select count(*) from public.bookings where status='out'),
  'returned_bookings',(select count(*) from public.bookings where status='returned'),
  'overdue_bookings',(select count(*) from public.bookings where status='out' and returns_on<today_local),
  'created_in_period',(select count(*) from public.bookings where created_at>=from_instant and created_at<until_instant),
  'receipt_count',(select count(*) from public.payments where recorded_at>=from_instant and recorded_at<until_instant),
  'receipt_piasters',(select coalesce(sum(amount_piasters),0)::text from public.payments where recorded_at>=from_instant and recorded_at<until_instant),
  'fee_count',(select count(*) from public.late_fees where created_at>=from_instant and created_at<until_instant),
  'fee_piasters',(select coalesce(sum(amount_piasters),0)::text from public.late_fees where created_at>=from_instant and created_at<until_instant),
  'outstanding_piasters',(select coalesce(sum(greatest(0,b.agreed_price_piasters+coalesce(f.total,0)-coalesce(p.total,0))),0)::text from public.bookings b left join (select booking_id,sum(amount_piasters) total from public.late_fees group by booking_id) f on f.booking_id=b.id left join (select booking_id,sum(amount_piasters) total from public.payments group by booking_id) p on p.booking_id=b.id where b.status<>'cancelled')
 ) into result;
 return result;
end $$;
revoke execute on function public.admin_dashboard(date,date) from public,anon,authenticated;
grant execute on function public.admin_dashboard(date,date) to authenticated;
commit;
