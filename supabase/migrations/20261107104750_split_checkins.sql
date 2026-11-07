begin;
-- A row still links one social/mood day to the following night.
-- Either complete check-in can arrive first; missing answers stay NULL.
alter table public.mindtrack_entries
  alter column social_minutes drop not null,
  alter column mood drop not null,
  alter column sleep_hours drop not null,
  alter column sleep_quality drop not null;
alter table public.mindtrack_entries
  drop constraint if exists mindtrack_entries_day_check,
  drop constraint if exists mindtrack_evening_answer_check,
  drop constraint if exists mindtrack_evening_total_check;
alter table public.mindtrack_entries add constraint mindtrack_entries_day_check
  check (day >= date '2020-01-01' and day <= (now() at time zone 'Europe/Prague')::date);
alter table public.mindtrack_entries add constraint mindtrack_evening_answer_check
  check ((sleep_hours is null and sleep_quality is null and num_nonnulls(bed_minutes,before_bed)=0)
      or (sleep_hours is not null and sleep_quality is not null and num_nonnulls(bed_minutes,before_bed)=1));
-- Evening usage can continue after the evening check-in, so no cross-check
-- against the earlier total. Existing legacy bed-minute validation stays.
alter table public.mindtrack_entries add constraint mindtrack_day_pair_check
  check ((social_minutes is null) = (mood is null));
alter table public.mindtrack_entries add constraint mindtrack_nonempty_check
  check (social_minutes is not null or sleep_hours is not null);
alter table public.mindtrack_entries add constraint mindtrack_completed_night_check
  check (sleep_hours is null or day < (now() at time zone 'Europe/Prague')::date);
comment on column public.mindtrack_entries.day is 'Day of evening social media/mood report. Sleep and before_bed refer to the following night, reported next morning. Each check-in may be absent (NULL).';
commit;
