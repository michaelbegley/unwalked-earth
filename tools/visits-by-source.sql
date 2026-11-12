-- Adds a per-day tally by where a visit came from (x, reddit, google, text and so on).
-- Still no IP address, no visitor id, no page address. Only the name of the source group is kept.

create table if not exists public.visit_sources (
  day date not null,
  src text not null,
  n integer not null default 0,
  primary key (day, src)
);

alter table public.visit_sources enable row level security;

drop function if exists public.hit();

create or replace function public.hit(src text default 'direct')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s text := case when src in ('x', 'reddit', 'hn', 'google', 'search', 'ai', 'facebook', 'instagram', 'threads', 'tiktok', 'youtube', 'linkedin', 'bluesky', 'discord', 'github', 'text', 'email', 'direct') then src else 'other' end;
begin
  insert into public.visit_slots (slot, n)
  values (to_timestamp(floor(extract(epoch from now()) / 600) * 600), 1)
  on conflict (slot) do update set n = public.visit_slots.n + 1;
  insert into public.visit_sources (day, src, n)
  values ((now() at time zone 'America/Chicago')::date, s, 1)
  on conflict on constraint visit_sources_pkey do update set n = public.visit_sources.n + 1;
end;
$$;

create or replace function public.visit_stats()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'last_30_min', coalesce((select sum(n) from public.visit_slots where slot > now() - interval '30 minutes'), 0),
    'today', coalesce((select sum(n) from public.visit_slots where slot >= date_trunc('day', now() at time zone 'America/Chicago') at time zone 'America/Chicago'), 0),
    'all_time', coalesce((select sum(n) from public.visit_slots), 0),
    'days', coalesce((
      select json_agg(d order by d.day desc) from (
        select (slot at time zone 'America/Chicago')::date as day, sum(n) as visits
        from public.visit_slots
        where slot > now() - interval '30 days'
        group by 1
      ) d), '[]'::json),
    'sources', coalesce((
      select json_agg(x order by x.visits desc) from (
        select src, sum(n) as visits
        from public.visit_sources
        where day > (now() at time zone 'America/Chicago')::date - 30
        group by src
      ) x), '[]'::json)
  );
$$;

revoke all on function public.hit(text) from public;
revoke all on function public.visit_stats() from public;
grant execute on function public.hit(text) to anon;
grant execute on function public.visit_stats() to anon;
