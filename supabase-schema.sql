create table if not exists public.tarefas (
    id uuid primary key,
    name text not null,
    description text,
    requested_by text,
    priority text not null default 'Média',
    date date not null,
    done boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.tarefas enable row level security;

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
