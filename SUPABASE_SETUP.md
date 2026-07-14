# Configuracao do Supabase

1. Crie um projeto no Supabase.
2. Em Authentication > Providers, mantenha Email habilitado.
3. Abra o SQL Editor e execute o conteudo de `supabase-schema.sql`.
4. No Supabase, va em Project Settings > API.
5. Copie a Project URL e a anon public key.
6. Preencha `js/config.js`:

```js
window.TAREFAS_SAF_SUPABASE = {
    url: "https://SEU-PROJETO.supabase.co",
    anonKey: "SUA_ANON_PUBLIC_KEY",
    table: "tarefas",
    meetingsTable: "reunioes"
};
```

Depois disso, o app passa a exigir login e sincroniza tarefas e reunioes no Supabase.

As politicas em `supabase-schema.sql` usam `auth.uid() = user_id`, entao cada usuario autenticado acessa apenas os proprios registros.
