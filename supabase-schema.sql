create table if not exists public.tarefas (
    id uuid primary key,
    name text not null,
    description text,
    requested_by text,
    priority text not null default 'Média',
    date date not null,
    reminder_day text,
    done boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.tarefas enable row level security;

alter table public.tarefas
add column if not exists reminder_day text;

alter table public.tarefas
alter column priority set default 'Média';

drop policy if exists "Permitir leitura anonima" on public.tarefas;
drop policy if exists "Permitir insercao anonima" on public.tarefas;
drop policy if exists "Permitir atualizacao anonima" on public.tarefas;
drop policy if exists "Permitir exclusao anonima" on public.tarefas;

create policy "Permitir leitura anonima"
on public.tarefas
for select
to anon
using (true);

create policy "Permitir insercao anonima"
on public.tarefas
for insert
to anon
with check (true);

create policy "Permitir atualizacao anonima"
on public.tarefas
for update
to anon
using (true)
with check (true);

create policy "Permitir exclusao anonima"
on public.tarefas
for delete
to anon
using (true);

create table if not exists public.reunioes (
    id uuid primary key,
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

alter table public.reunioes enable row level security;

drop policy if exists "Permitir leitura anonima reunioes" on public.reunioes;
drop policy if exists "Permitir insercao anonima reunioes" on public.reunioes;
drop policy if exists "Permitir atualizacao anonima reunioes" on public.reunioes;
drop policy if exists "Permitir exclusao anonima reunioes" on public.reunioes;

create policy "Permitir leitura anonima reunioes"
on public.reunioes
for select
to anon
using (true);

create policy "Permitir insercao anonima reunioes"
on public.reunioes
for insert
to anon
with check (true);

create policy "Permitir atualizacao anonima reunioes"
on public.reunioes
for update
to anon
using (true)
with check (true);

create policy "Permitir exclusao anonima reunioes"
on public.reunioes
for delete
to anon
using (true);


