-- 1) Gelen mailler (panelde okunacak)
create table if not exists inbox_messages (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  from_email text not null,
  from_name text,
  subject text,
  snippet text,
  text_body text,
  html_body text,
  attachments jsonb not null default '[]'::jsonb,
  provider text not null default 'postmark',
  provider_message_id text,
  received_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','converted','archived'))
);

-- 2) Lead (10+ talepler)
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('form','inbound_email','manual')),
  company_name text,
  contact_name text,
  email text,
  phone text,
  users_expected int,
  note text,
  inbox_message_id uuid references inbox_messages(id) on delete set null,
  status text not null default 'new' check (status in ('new','contacted','converted','archived')),
  created_at timestamptz not null default now()
);

-- 3) Teklif
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  company_name text not null,
  contact_name text,
  email text not null,
  users_count int not null check (users_count > 0),
  offer_type text not null check (offer_type in ('paid','pilot')),
  price_try numeric(12,2) not null default 0,
  token text not null unique,
  link_expires_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft','sent','opened','registered','paid','active','expired','canceled')),
  accepted_org_id uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Timeline
create table if not exists offer_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
