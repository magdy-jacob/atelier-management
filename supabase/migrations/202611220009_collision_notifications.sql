begin;
-- A critical admin notice only: this migration does not modify bookings,
-- availability, preparation rules, fees or handover permissions.
alter table public.notification_reads drop constraint notification_reads_kind_check;
alter table public.notification_reads add constraint notification_reads_kind_check check(kind in ('outgoing','incoming','overdue','collision'));
create or replace function public.get_admin_notifications(p_kind text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today_local date;zone text;result jsonb;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501';end if;
 select business_timezone into zone from public.settings where id=true and date_precision='day';
 if zone is distinct from 'Africa/Cairo' then raise exception 'confirmed_timezone_required';end if;
 if p_kind is not null and p_kind not in ('outgoing','incoming','overdue','collision') then raise exception 'invalid_notification_type';end if;
 today_local:=(now() at time zone zone)::date;
 with alerts as (
 select b.id booking_id,'outgoing'::text kind,b.starts_on-1 event_on,b.starts_on,b.returns_on,d.name dress_name,c.full_name customer_name,null::uuid related_booking_id,null::date related_starts_on from public.bookings b join public.dresses d on d.id=b.dress_id join public.customers c on c.id=b.customer_id where b.status='confirmed' and b.starts_on<=today_local+1
 union all
 select b.id,'incoming',b.returns_on,b.starts_on,b.returns_on,d.name,c.full_name,null::uuid,null::date from public.bookings b join public.dresses d on d.id=b.dress_id join public.customers c on c.id=b.customer_id where b.status='out' and b.returns_on=today_local
 union all
 select b.id,'overdue',b.returns_on+1,b.starts_on,b.returns_on,d.name,c.full_name,null::uuid,null::date from public.bookings b join public.dresses d on d.id=b.dress_id join public.customers c on c.id=b.customer_id where b.status='out' and b.returns_on<today_local
 union all
 select b.id,'collision',n.starts_on-1,b.starts_on,b.returns_on,d.name,c.full_name,n.id,n.starts_on
 from public.bookings b join public.dresses d on d.id=b.dress_id join public.customers c on c.id=b.customer_id
 join lateral(select next.id,next.starts_on from public.bookings next where next.dress_id=b.dress_id and next.id<>b.id and next.status in ('confirmed','out') and next.starts_on>b.returns_on and next.starts_on<today_local+2 order by next.starts_on,next.id limit 1)n on true
 where b.status='out' and b.returns_on<today_local
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
  or (p_kind='collision' and b.status='out' and b.returns_on<today_local and exists(select 1 from public.bookings n where n.dress_id=b.dress_id and n.id<>b.id and n.status in ('confirmed','out') and n.starts_on>b.returns_on and n.starts_on<today_local+2 and p_event_on=n.starts_on-1))
 ) then raise exception 'notification_not_active';end if;
 insert into public.notification_reads(user_id,booking_id,kind,event_on) values(auth.uid(),p_booking_id,p_kind,p_event_on) on conflict do nothing;
end $$;
revoke execute on function public.get_admin_notifications(text),public.mark_notification_read(uuid,text,date) from public,anon,authenticated;
grant execute on function public.get_admin_notifications(text),public.mark_notification_read(uuid,text,date) to authenticated;
commit;
