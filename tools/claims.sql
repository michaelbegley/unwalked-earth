-- "I have stood here": a visitor's claim about an orange place. A claim needs proof: either the
-- visitor's device confirmed it was within 25 km (here = true; the location itself is never sent)
-- or a link (proof). Stores the spot, an optional note,
-- the site version and the time. Nobody can read the table from the site; read it in the Supabase
-- table editor. Set ok to true or false there once a claim is checked.
-- Replace YOUR-TOPIC with the private ntfy topic before running. Keep the real name out of this repo.

create table if not exists public.claims (
  id bigint generated always as identity primary key,
  sent timestamptz not null default now(),
  lat numeric(6,3) not null,
  lon numeric(7,3) not null,
  note text,
  ver text,
  ok boolean
);

alter table public.claims enable row level security;

create or replace function public.send_claim(lat numeric, lon numeric, note text default null, ver text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if lat is null or lon is null or abs(lat) > 90 or abs(lon) > 180 then return false; end if;
  -- at most 60 claims an hour in total
  if (select count(*) from public.claims c where c.sent > now() - interval '1 hour') >= 60 then return false; end if;
  insert into public.claims (lat, lon, note, ver)
  values (round(lat, 3), round(lon, 3), nullif(left(btrim(coalesce(note, '')), 500), ''), left(ver, 12));
  return true;
end;
$$;

revoke all on function public.send_claim(numeric, numeric, text, text) from public;
grant execute on function public.send_claim(numeric, numeric, text, text) to anon;

create or replace function public.claim_ping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://ntfy.sh/',
      body := jsonb_build_object(
        'topic', 'YOUR-TOPIC',
        'title', 'unwalked.earth',
        'message', 'Someone says they stood at ' || new.lat || ', ' || new.lon || ' (' || (select count(*) from public.claims) || ' claims in all)',
        'click', 'https://supabase.com/dashboard/project/cpzhsztczixiidxypvmb/editor'
      ),
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  exception when others then null;
  end;
  return new;
end
$$;

revoke all on function public.claim_ping() from public, anon, authenticated;

create or replace trigger claim_ping
after insert on public.claims
for each row execute function public.claim_ping();

-- Proof (added 15 Nov 2026). The first version of send_claim took no proof; it now always says no.
alter table public.claims add column if not exists here boolean not null default false, add column if not exists proof text;

create or replace function public.send_claim(lat numeric, lon numeric, note text default null, ver text default null)
returns boolean language sql security definer set search_path = public as $$ select false $$;

create or replace function public.send_claim(lat numeric, lon numeric, note text, ver text, here boolean, proof text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare p text := nullif(left(btrim(coalesce(proof, '')), 300), '');
begin
  if lat is null or lon is null or abs(lat) > 90 or abs(lon) > 180 then return false; end if;
  if not coalesce(here, false) and (p is null or p !~* '^https?://') then return false; end if;
  if (select count(*) from public.claims c where c.sent > now() - interval '1 hour') >= 60 then return false; end if;
  insert into public.claims (lat, lon, note, ver, here, proof)
  values (round(lat, 3), round(lon, 3), nullif(left(btrim(coalesce(note, '')), 500), ''), left(ver, 12), coalesce(here, false), p);
  return true;
end;
$$;

revoke all on function public.send_claim(numeric, numeric, text, text, boolean, text) from public;
grant execute on function public.send_claim(numeric, numeric, text, text, boolean, text) to anon;
-- claim_ping's message also says "(checked on the spot)" or "(sent a link)".
