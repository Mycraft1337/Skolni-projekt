-- Existing clients continue sending sleep_hours. Whole minutes are always in sync.
alter table public.mindtrack_entries add column if not exists sleep_minutes integer generated always as (round(sleep_hours * 60)::integer) stored;
comment on column public.mindtrack_entries.sleep_minutes is 'Total sleep duration in whole minutes for analysis and export; automatically derived from legacy decimal hours.';
