-- Platform-level gateway settings
-- Allows admins to globally enable/disable/hide any payment gateway for all tenants

create table if not exists public.platform_gateway_settings (
  gateway_key text primary key,
  enabled     boolean not null default true,
  visible     boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- No RLS needed: only accessible via service_role (edge functions)
-- But expose via anon for the client-side "visible" check (read-only)
alter table public.platform_gateway_settings enable row level security;

drop policy if exists "anon_read_gateway_settings" on public.platform_gateway_settings;
create policy "anon_read_gateway_settings"
  on public.platform_gateway_settings
  for select
  using (true);

drop policy if exists "service_role_all_gateway_settings" on public.platform_gateway_settings;
create policy "service_role_all_gateway_settings"
  on public.platform_gateway_settings
  for all
  using (auth.role() = 'service_role');
