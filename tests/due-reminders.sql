-- Integration test: synthetic data is rolled back; never sends push messages.
begin;
insert into auth.users(id)
select ('0f000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,1005) i;
insert into public.mindtrack_push_subscriptions(user_id,subscription,timezone,morning)
select ('0f000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '{"endpoint":"https://web.push.apple.com/test-only"}'::jsonb,'Europe/Prague',
 case when i=1005 then time '08:00' else time '20:00' end from generate_series(1,1005) i;
create temporary table claimed_test as select * from public.mindtrack_claim_due_reminders(100,'2026-01-02T07:00:00Z');
do $$ begin
 if (select count(*) from claimed_test where user_id::text like '0f000000-%')<>1 then raise exception 'Not-due filtering failed';end if;
 if not exists(select 1 from claimed_test where user_id='0f000000-0000-4000-8000-000000001005' and day=date '2026-01-02' and period='morning') then raise exception 'Subscriber beyond old 1000 cutoff missing';end if;
 if exists(select 1 from public.mindtrack_claim_due_reminders(100,'2026-01-02T07:01:00Z') where user_id::text like '0f000000-%') then raise exception 'Duplicate claim';end if;
 if exists(select 1 from public.mindtrack_claim_due_reminders(100,'2026-01-03T07:15:00Z') where user_id::text like '0f000000-%') then raise exception 'Expired window';end if;
 if not exists(select 1 from public.mindtrack_claim_due_reminders(100,'2026-07-02T06:00:00Z') where user_id='0f000000-0000-4000-8000-000000001005') then raise exception 'DST summer time failed';end if;
end $$;
-- Completed morning belongs to the prior evening's research row.
insert into public.mindtrack_participants(user_id,consent_version) values('0f000000-0000-4000-8000-000000001005','2026-11-v3-auto-notice');
insert into public.mindtrack_entries(user_id,day,sleep_hours,sleep_quality,before_bed)
values('0f000000-0000-4000-8000-000000001005','2026-01-03',8,4,false);
do $$ begin
 if exists(select 1 from public.mindtrack_claim_due_reminders(100,'2026-01-04T07:00:00Z') where user_id='0f000000-0000-4000-8000-000000001005') then raise exception 'Completed sleep was not skipped';end if;
 if has_function_privilege('authenticated','public.mindtrack_claim_due_reminders(integer,timestamp with time zone)','execute') then raise exception 'Client can claim';end if;
 if has_function_privilege('anon','public.mindtrack_claim_due_reminders(integer,timestamp with time zone)','execute') then raise exception 'Anonymous role can claim';end if;
end $$;
-- Batched draining, without the old fixed first-1000 scan cutoff.
update public.mindtrack_push_subscriptions set morning='08:00' where user_id::text like '0f000000-%';
do $$ declare batch integer; total integer:=0; begin
 for i in 1..50 loop
  select count(*) into batch from public.mindtrack_claim_due_reminders(25,'2026-01-05T07:00:00Z') where user_id::text like '0f000000-%';
  total:=total+batch;
 end loop;
 if total<>1005 then raise exception 'Batch drain failed: %',total;end if;
end $$;
select 'passed' as result,1005 as synthetic_subscribers,1 as due_in_initial_test;
rollback;
