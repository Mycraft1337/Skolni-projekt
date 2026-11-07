begin;
alter table public.mindtrack_entries add column morning_recorded_at timestamptz, add column evening_recorded_at timestamptz,
 add column morning_received_at timestamptz, add column evening_received_at timestamptz;
create function public.mindtrack_receive_times() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  new.morning_received_at:=case when new.sleep_hours is not null then now() end;
  new.evening_received_at:=case when new.social_minutes is not null then now() end;
 else
  new.morning_received_at:=old.morning_received_at; new.evening_received_at:=old.evening_received_at;
  if (new.sleep_hours,new.sleep_quality,new.before_bed,new.bed_minutes,new.morning_recorded_at) is distinct from
     (old.sleep_hours,old.sleep_quality,old.before_bed,old.bed_minutes,old.morning_recorded_at) then new.morning_received_at:=now();end if;
  if (new.social_minutes,new.mood,new.evening_recorded_at) is distinct from
     (old.social_minutes,old.mood,old.evening_recorded_at) then new.evening_received_at:=now();end if;
 end if;return new;
end $$;
create trigger mindtrack_received_times before insert or update on public.mindtrack_entries for each row execute function public.mindtrack_receive_times();
create table public.mindtrack_device_links(device_id uuid primary key references auth.users(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade);
alter table public.mindtrack_device_links enable row level security;
revoke all on public.mindtrack_device_links from public,anon,authenticated;
grant select on public.mindtrack_device_links to authenticated; grant all on public.mindtrack_device_links to service_role;
create policy device_own_read on public.mindtrack_device_links for select to authenticated using(device_id=(select auth.uid()));
create function public.mindtrack_owner() returns uuid language sql stable security invoker set search_path='' as $$
 select coalesce((select owner_id from public.mindtrack_device_links where device_id=(select auth.uid())),(select auth.uid()));
$$;
revoke all on function public.mindtrack_owner() from public,anon;grant execute on function public.mindtrack_owner() to authenticated,service_role;
alter policy entry_select on public.mindtrack_entries using(user_id=(select public.mindtrack_owner()));
alter policy entry_insert on public.mindtrack_entries with check(user_id=(select public.mindtrack_owner()));
alter policy entry_update on public.mindtrack_entries using(user_id=(select public.mindtrack_owner())) with check(user_id=(select public.mindtrack_owner()));
alter policy entry_delete on public.mindtrack_entries using(user_id=(select public.mindtrack_owner()));
alter policy participant_select on public.mindtrack_participants using(user_id=(select public.mindtrack_owner()));
alter policy participant_insert on public.mindtrack_participants with check(user_id=(select public.mindtrack_owner()));
alter policy participant_delete on public.mindtrack_participants using(user_id=(select public.mindtrack_owner()));
alter policy push_own_read on public.mindtrack_push_subscriptions using(user_id=(select public.mindtrack_owner()));
create table public.mindtrack_recovery(owner_id uuid primary key references auth.users(id) on delete cascade,token_hash text unique not null);
alter table public.mindtrack_recovery enable row level security;
revoke all on public.mindtrack_recovery from public,anon,authenticated; grant all on public.mindtrack_recovery to service_role;
alter table public.mindtrack_push_config add column research_token text not null default (gen_random_uuid()::text||gen_random_uuid()::text);
commit;
create function public.mindtrack_save_entry(p_record jsonb,p_parts text[]) returns public.mindtrack_entries
language sql security invoker set search_path='' as $$
 insert into public.mindtrack_entries as e(user_id,day,social_minutes,mood,sleep_hours,sleep_quality,before_bed,bed_minutes,morning_recorded_at,evening_recorded_at)
 select (select public.mindtrack_owner()),(p_record->>'day')::date,
 (p_record->>'social_minutes')::integer,(p_record->>'mood')::integer,(p_record->>'sleep_hours')::numeric,
 (p_record->>'sleep_quality')::integer,(p_record->>'before_bed')::boolean,(p_record->>'bed_minutes')::integer,
 (p_record->>'morning_recorded_at')::timestamptz,(p_record->>'evening_recorded_at')::timestamptz
 on conflict(user_id,day) do update set
 social_minutes=case when 'evening'=any(p_parts) then excluded.social_minutes else e.social_minutes end,
 mood=case when 'evening'=any(p_parts) then excluded.mood else e.mood end,
 evening_recorded_at=case when 'evening'=any(p_parts) then excluded.evening_recorded_at else e.evening_recorded_at end,
 sleep_hours=case when 'morning'=any(p_parts) then excluded.sleep_hours else e.sleep_hours end,
 sleep_quality=case when 'morning'=any(p_parts) then excluded.sleep_quality else e.sleep_quality end,
 before_bed=case when 'morning'=any(p_parts) then excluded.before_bed else e.before_bed end,
 bed_minutes=case when 'morning'=any(p_parts) then excluded.bed_minutes else e.bed_minutes end,
 morning_recorded_at=case when 'morning'=any(p_parts) then excluded.morning_recorded_at else e.morning_recorded_at end
 returning e.*;
$$;
revoke all on function public.mindtrack_save_entry(jsonb,text[]) from public,anon;
grant execute on function public.mindtrack_save_entry(jsonb,text[]) to authenticated;
