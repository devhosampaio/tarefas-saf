create table if not exists public.tarefas (
    id uuid primary key,
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    description text,
    requested_by text,
    priority text not null default 'Média',
    date date not null,
    reminder_day text,
    done boolean not null default false,
    completed_at date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.tarefas
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.tarefas
add column if not exists reminder_day text;

alter table public.tarefas
add column if not exists completed_at date;

alter table public.tarefas
alter column priority set default 'Média';

alter table public.tarefas enable row level security;

drop policy if exists "Permitir leitura anonima" on public.tarefas;
drop policy if exists "Permitir insercao anonima" on public.tarefas;
drop policy if exists "Permitir atualizacao anonima" on public.tarefas;
drop policy if exists "Permitir exclusao anonima" on public.tarefas;
drop policy if exists "Tarefas leitura do proprio usuario" on public.tarefas;
drop policy if exists "Tarefas insercao do proprio usuario" on public.tarefas;
drop policy if exists "Tarefas atualizacao do proprio usuario" on public.tarefas;
drop policy if exists "Tarefas exclusao do proprio usuario" on public.tarefas;

create policy "Tarefas leitura do proprio usuario"
on public.tarefas
for select
to authenticated
using (auth.uid() = user_id);

create policy "Tarefas insercao do proprio usuario"
on public.tarefas
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Tarefas atualizacao do proprio usuario"
on public.tarefas
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Tarefas exclusao do proprio usuario"
on public.tarefas
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.reunioes (
    id uuid primary key,
    user_id uuid references auth.users(id) on delete cascade,
    subject text not null,
    date date not null,
    format text not null default 'Presencial',
    start_time time not null,
    end_time time not null,
    duration_minutes integer not null default 0,
    participants text,
    my_role text not null,
    location text,
    decisions text,
    responsible text,
    deadline date,
    status text not null default 'Agendada',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.reunioes
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.reunioes enable row level security;

drop policy if exists "Permitir leitura anonima reunioes" on public.reunioes;
drop policy if exists "Permitir insercao anonima reunioes" on public.reunioes;
drop policy if exists "Permitir atualizacao anonima reunioes" on public.reunioes;
drop policy if exists "Permitir exclusao anonima reunioes" on public.reunioes;
drop policy if exists "Reunioes leitura do proprio usuario" on public.reunioes;
drop policy if exists "Reunioes insercao do proprio usuario" on public.reunioes;
drop policy if exists "Reunioes atualizacao do proprio usuario" on public.reunioes;
drop policy if exists "Reunioes exclusao do proprio usuario" on public.reunioes;

create policy "Reunioes leitura do proprio usuario"
on public.reunioes
for select
to authenticated
using (auth.uid() = user_id);

create policy "Reunioes insercao do proprio usuario"
on public.reunioes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Reunioes atualizacao do proprio usuario"
on public.reunioes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Reunioes exclusao do proprio usuario"
on public.reunioes
for delete
to authenticated
using (auth.uid() = user_id);
