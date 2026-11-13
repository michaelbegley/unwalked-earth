-- Sends a phone notification through ntfy.sh each time a feedback note is added.
-- Only "New feedback note (N in all)" is sent. The note's text never leaves the database.
-- Replace YOUR-TOPIC with the private topic name before running. Keep the real name out of this repo.

create extension if not exists pg_net;

create or replace function public.feedback_ping()
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
        'message', 'New feedback note (' || (select count(*) from public.feedback) || ' in all)',
        'click', 'https://supabase.com/dashboard/project/cpzhsztczixiidxypvmb/editor'
      ),
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  exception when others then null; -- a failed ping must never block a note
  end;
  return new;
end
$$;

revoke all on function public.feedback_ping() from public, anon, authenticated;

create or replace trigger feedback_ping
after insert on public.feedback
for each row execute function public.feedback_ping();
