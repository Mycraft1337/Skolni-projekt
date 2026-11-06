-- Applied on 2026-11-06; safe to replay.
alter table public.mindtrack_entries add column if not exists before_bed boolean;
alter table public.mindtrack_entries alter column bed_minutes drop not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='mindtrack_evening_answer_check' and conrelid='public.mindtrack_entries'::regclass) then
  alter table public.mindtrack_entries add constraint mindtrack_evening_answer_check check (num_nonnulls(bed_minutes,before_bed)=1);
 end if;
 if not exists(select 1 from pg_constraint where conname='mindtrack_evening_total_check' and conrelid='public.mindtrack_entries'::regclass) then
  alter table public.mindtrack_entries add constraint mindtrack_evening_total_check check (before_bed is not true or social_minutes > 0);
 end if;
end $$;
