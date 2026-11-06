-- New, isolated v2 tables. Existing anonymous_entries and its data are untouched.
begin;
create table public.mindtrack_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_version text not null check (consent_version = '2026-11-v2'),
  consent_at timestamptz not null default now()
);
create table public.mindtrack_entries (
  user_id uuid not null references public.mindtrack_participants(user_id) on delete cascade,
  day date not null check (day >= date '2020-01-01' and day < (now() at time zone 'Europe/Prague')::date),
  social_minutes integer not null check (social_minutes between 0 and 1440),
  bed_minutes integer not null check (bed_minutes between 0 and 60 and bed_minutes <= social_minutes),
  sleep_hours numeric(4,2) not null check (sleep_hours between 0 and 24),
  sleep_quality integer not null check (sleep_quality between 1 and 5),
  mood integer not null check (mood between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key(user_id,day)
);
alter table public.mindtrack_participants enable row level security;
alter table public.mindtrack_entries enable row level security;
revoke all on public.mindtrack_participants, public.mindtrack_entries from anon, authenticated;
grant select, insert, delete on public.mindtrack_participants to authenticated;
grant select, insert, update, delete on public.mindtrack_entries to authenticated;
create policy participant_select on public.mindtrack_participants for select to authenticated using ((select auth.uid()) = user_id);
create policy participant_insert on public.mindtrack_participants for insert to authenticated with check ((select auth.uid()) = user_id);
create policy participant_delete on public.mindtrack_participants for delete to authenticated using ((select auth.uid()) = user_id);
create policy entry_select on public.mindtrack_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy entry_insert on public.mindtrack_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy entry_update on public.mindtrack_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy entry_delete on public.mindtrack_entries for delete to authenticated using ((select auth.uid()) = user_id);
create function public.mindtrack_touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger mindtrack_entries_updated before update on public.mindtrack_entries for each row execute function public.mindtrack_touch_updated_at();
commit;
