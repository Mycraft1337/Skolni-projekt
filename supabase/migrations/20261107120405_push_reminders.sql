begin;
create table public.mindtrack_push_config (
 id integer primary key check(id=1),
 cron_token uuid not null default gen_random_uuid(),
 vapid_public text,
 vapid_private text
);
-- Server-only configuration. Never readable from a browser, including signed-in users.
alter table public.mindtrack_push_config enable row level security;
revoke all on public.mindtrack_push_config from public,anon,authenticated;
grant all on public.mindtrack_push_config to service_role;
insert into public.mindtrack_push_config(id) values(1);
create table public.mindtrack_push_subscriptions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 subscription jsonb not null,
 timezone text not null,
 morning time,
 evening time,
 updated_at timestamptz not null default now(),
 last_test_at timestamptz,
 check(morning is not null or evening is not null),
 check(jsonb_typeof(subscription)='object')
);
alter table public.mindtrack_push_subscriptions enable row level security;
revoke all on public.mindtrack_push_subscriptions from public,anon,authenticated;
grant select on public.mindtrack_push_subscriptions to authenticated;
grant all on public.mindtrack_push_subscriptions to service_role;
create policy push_own_read on public.mindtrack_push_subscriptions for select to authenticated using ((select auth.uid())=user_id);
-- All changes are authenticated and validated by the Edge Function, not arbitrary REST writes.
create table public.mindtrack_push_deliveries (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 period text not null check(period in ('morning','evening')),
 status text not null check(status in ('claimed','sent','failed','skipped')),
 attempted_at timestamptz not null default now(),
 primary key(user_id,day,period)
);
alter table public.mindtrack_push_deliveries enable row level security;
revoke all on public.mindtrack_push_deliveries from public,anon,authenticated;
grant all on public.mindtrack_push_deliveries to service_role;
comment on table public.mindtrack_push_deliveries is 'One scheduled attempt per user/local day/period, atomically claimed before sending; no answers or push payloads logged.';
commit;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
-- Project-specific URL; the cron credential remains inside the database.
select cron.schedule('mindtrack-reminders','* * * * *',$job$
 select net.http_post(
  url:='https://rukeziypxobbwzrjnlqj.supabase.co/functions/v1/mindtrack-push',
  headers:=jsonb_build_object('Content-Type','application/json','x-mindtrack-cron',
    (select cron_token::text from public.mindtrack_push_config where id=1)),
  body:='{"action":"tick"}'::jsonb,
  timeout_milliseconds:=120000
 );
$job$);
