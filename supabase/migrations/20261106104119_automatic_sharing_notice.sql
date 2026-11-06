-- Applied 2026-11-06; distinguish the new notice from old explicit confirmation.
begin;
alter table public.mindtrack_participants drop constraint if exists mindtrack_participants_consent_version_check;
alter table public.mindtrack_participants add constraint mindtrack_participants_consent_version_check check (consent_version in ('2026-11-v2','2026-11-v3-auto-notice'));
comment on column public.mindtrack_participants.consent_version is 'Legacy v2 explicit sharing confirmation; v3-auto-notice denotes automatic sharing with inline information, not an explicit consent checkbox.';
commit;
