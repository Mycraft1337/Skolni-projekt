begin;
create index if not exists mindtrack_push_deliveries_day_idx on public.mindtrack_push_deliveries(day);
-- Filter inside Postgres. No subscription endpoint or encryption key leaves the
-- database until the dispatcher actually needs to send a due notification.
create or replace function public.mindtrack_claim_due_reminders(p_limit integer default 25, p_now timestamptz default now())
returns table(user_id uuid, day date, period text, updated_at timestamptz)
language sql volatile security invoker set search_path = ''
as $$
 with due as materialized (
  select s.user_id, clock.local_now::date as day, slot.period, s.updated_at,
         clock.local_now::date + slot.at_time as due_at
  from public.mindtrack_push_subscriptions s
  cross join lateral (select p_now at time zone s.timezone as local_now) clock
  cross join lateral (values ('morning'::text,s.morning),('evening'::text,s.evening)) slot(period,at_time)
  where slot.at_time is not null
    and clock.local_now >= clock.local_now::date + slot.at_time
    and clock.local_now < clock.local_now::date + slot.at_time + interval '15 minutes'
    and not exists (
      select 1 from public.mindtrack_push_deliveries d
      where d.user_id=s.user_id and d.day=clock.local_now::date and d.period=slot.period
    )
    and not exists (
      select 1 from public.mindtrack_entries e
      where e.user_id=s.user_id
        and e.day=clock.local_now::date - case when slot.period='morning' then 1 else 0 end
        and case when slot.period='morning' then e.sleep_hours is not null else e.social_minutes is not null end
    )
  order by due_at,s.user_id,slot.period
  limit greatest(1,least(coalesce(p_limit,25),100))
 ), claimed as (
  insert into public.mindtrack_push_deliveries as delivery(user_id,day,period,status)
  select d.user_id,d.day,d.period,'claimed' from due d
  on conflict(user_id,day,period) do nothing
  returning delivery.user_id,delivery.day,delivery.period
 )
 select d.user_id,d.day,d.period,d.updated_at from due d
 join claimed c on c.user_id=d.user_id and c.day=d.day and c.period=d.period;
$$;
revoke all on function public.mindtrack_claim_due_reminders(integer,timestamptz) from public,anon,authenticated;
grant execute on function public.mindtrack_claim_due_reminders(integer,timestamptz) to service_role;
commit;
