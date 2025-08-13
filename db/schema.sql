-- Day 1 schema: folders, files, permissions, shared_links

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.folders(id) on delete set null,
  owner_email text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null,
  mime_type text,
  size bigint,
  folder_id uuid references public.folders(id) on delete set null,
  owner_email text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists public.permissions (
  id bigserial primary key,
  resource_type text check (resource_type in ('file','folder')) not null,
  resource_id uuid not null,
  grantee_email text not null,
  role text check (role in ('viewer','editor','owner')) not null,
  created_at timestamptz default now()
);

create table if not exists public.shared_links (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  resource_type text check (resource_type in ('file','folder')) not null,
  resource_id uuid not null,
  role text check (role in ('viewer','editor')) not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_files_owner on public.files(owner_email);
create index if not exists idx_folders_owner on public.folders(owner_email);
create index if not exists idx_permissions_resource on public.permissions(resource_type, resource_id);


