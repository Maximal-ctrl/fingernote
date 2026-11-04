-- Referenzschema für einen späteren Server (Postgres). Die App selbst nutzt IndexedDB (src/db/db.ts).
create table notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  color text not null,
  favorite boolean not null default false,
  default_paper jsonb not null default '{"type":"lined","color":"white"}',
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on notebooks (user_id, sort_order);

create table sections (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  title text not null,
  color text not null,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on sections (notebook_id, sort_order);

create table pages (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  title text not null default '',
  level smallint not null default 0 check (level between 0 and 2),
  paper jsonb not null,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on pages (section_id, sort_order);
create index on pages (deleted_at) where deleted_at is not null;

create table assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mime text not null,
  bytes bigint not null,
  storage_key text not null,
  created_at timestamptz not null default now()
);

create table blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  kind text not null check (kind in ('text','image','pdf')),
  x real not null, y real not null, w real not null, h real,
  html text,
  asset_id uuid references assets(id) on delete restrict,
  pdf_page int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on blocks (page_id);
create index on blocks (asset_id);

create table strokes (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  tool text not null check (tool in ('pen','highlighter','shape')),
  color text not null,
  width real not null check (width > 0),
  points jsonb not null,           -- [[x,y,pressure], ...]
  created_at timestamptz not null default now()
);
create index on strokes (page_id);
