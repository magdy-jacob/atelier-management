begin;
-- Read-only, bounded receipt journal. No financial or customer state changes.
create index if not exists payments_report_period_idx on public.payments(recorded_at,id);
create function public.admin_receipt_report(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare zone text;result jsonb;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'invalid_reporting_period';end if;
 select business_timezone into zone from public.settings where id=true and date_precision='day';
 if zone is distinct from 'Africa/Cairo' then raise exception 'confirmed_timezone_required';end if;
 with journal as (
  select p.id receipt_id,p.booking_id,p.recorded_at,p.amount_piasters::text amount_piasters,p.method,
   d.code dress_code,d.name dress_name,c.full_name customer_name,c.phone customer_phone,pr.full_name recorded_by_name
  from public.payments p join public.bookings b on b.id=p.booking_id join public.dresses d on d.id=b.dress_id
  join public.customers c on c.id=b.customer_id left join public.profiles pr on pr.id=p.recorded_by
  where p.recorded_at>=p_from::timestamp at time zone zone and p.recorded_at<(p_to+1)::timestamp at time zone zone
  order by p.recorded_at,p.id limit 5001
 ) select jsonb_build_object('from',p_from,'to',p_to,'generated_at',now(),'count',count(*),
  'amount_piasters',coalesce(sum(amount_piasters::numeric),0)::text,
  'rows',coalesce(jsonb_agg(to_jsonb(journal) order by recorded_at,receipt_id),'[]'::jsonb)) into result from journal;
 if (result->>'count')::int>5000 then raise exception 'report_too_large_narrow_period';end if;
 return result;
end $$;
revoke execute on function public.admin_receipt_report(date,date) from public,anon,authenticated;
grant execute on function public.admin_receipt_report(date,date) to authenticated;
commit;
