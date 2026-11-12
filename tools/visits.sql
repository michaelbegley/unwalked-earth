-- Unwalked Earth visit counter.
-- Stores only a number per ten-minute slot. No IP address, no visitor id, no page, nothing about who visited.

create table if not exists public.visit_slots (
  slot timestamptz primary key,
  n integer not null default 0
);

alter table public.visit_slots enable row level security;
-- no policies: the table cannot be read or written directly with the public key

create or replace function public.hit()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visit_slots (slot, n)
  values (to_timestamp(floor(extract(epoch from now()) / 600) * 600), 1)
  on conflict (slot) do update set n = public.visit_slots.n + 1;
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
      ) d), '[]'::json)
  );
$$;

revoke all on function public.hit() from public;
revoke all on function public.visit_stats() from public;
grant execute on function public.hit() to anon;
grant execute on function public.visit_stats() to anon;
