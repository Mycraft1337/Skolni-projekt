-- No lasting test data. Device 2 recovers owner 1; device 3 must remain isolated.
begin;
insert into auth.users(id) values('0e000000-0000-4000-8000-000000000001'),('0e000000-0000-4000-8000-000000000002'),('0e000000-0000-4000-8000-000000000003');
insert into public.mindtrack_participants(user_id,consent_version) values('0e000000-0000-4000-8000-000000000001','2026-11-v3-auto-notice');
insert into public.mindtrack_device_links(device_id,owner_id) values('0e000000-0000-4000-8000-000000000002','0e000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','0e000000-0000-4000-8000-000000000002',true);
select public.mindtrack_save_entry('{"day":"2026-01-01","sleep_hours":8,"sleep_quality":4,"before_bed":false,"morning_recorded_at":"2026-01-02T07:00:00Z"}',array['morning']);
select public.mindtrack_save_entry('{"day":"2026-01-01","social_minutes":90,"mood":4,"evening_recorded_at":"2026-01-01T19:00:00Z"}',array['evening']);
do $$ begin
 if not exists(select 1 from public.mindtrack_entries where day='2026-01-01' and sleep_hours=8 and social_minutes=90 and morning_received_at is not null and evening_received_at is not null and user_id='0e000000-0000-4000-8000-000000000001') then raise exception 'Merge/ownership failed';end if;
 if has_table_privilege('authenticated','public.mindtrack_device_links','insert') or has_table_privilege('authenticated','public.mindtrack_recovery','select') or has_table_privilege('authenticated','public.mindtrack_push_config','select') then raise exception 'Client has privileged access';end if;
end $$;
select set_config('request.jwt.claim.sub','0e000000-0000-4000-8000-000000000003',true);
do $$ begin if exists(select 1 from public.mindtrack_entries) then raise exception 'Other user can read';end if;end $$;
rollback;
