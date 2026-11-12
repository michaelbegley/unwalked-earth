-- Feedback typed into the site. Only the text, the site version and the time are kept (columns msg, ver, sent).
-- Nobody can read the table from the site; read it in the Supabase table editor.

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  sent timestamptz not null default now(),
  ver text,
  msg text not null
);

alter table public.feedback enable row level security;

create or replace function public.send_feedback(msg text, ver text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if msg is null or length(btrim(msg)) = 0 then return; end if;
  -- at most 30 notes an hour in total, so the table cannot be flooded
  if (select count(*) from public.feedback where sent > now() - interval '1 hour') >= 30 then return; end if;
  insert into public.feedback (ver, msg) values (left(ver, 12), left(btrim(msg), 1000));
end;
$$;

revoke all on function public.send_feedback(text, text) from public;
grant execute on function public.send_feedback(text, text) to anon;

-- The stats page shows how many notes there are, never the notes themselves.
create or replace function public.feedback_count()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'all_time', (select count(*) from public.feedback),
    'last_7_days', (select count(*) from public.feedback where sent > now() - interval '7 days')
  );
$$;

revoke all on function public.feedback_count() from public;
grant execute on function public.feedback_count() to anon;
