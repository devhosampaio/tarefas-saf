# Configuracao do Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute o conteudo de `supabase-schema.sql`.
3. No Supabase, va em Project Settings > API.
4. Copie a Project URL e a anon public key.
5. Preencha `js/config.js`:

```js
window.TAREFAS_SAF_SUPABASE = {
    url: "https://SEU-PROJETO.supabase.co",
    anonKey: "SUA_ANON_PUBLIC_KEY",
    table: "tarefas"
};
```

Depois disso, o app deixa de depender do armazenamento do navegador e passa a sincronizar as tarefas pelo Supabase.

Observacao: as politicas em `supabase-schema.sql` liberam leitura e escrita anonimas. Para um uso publico, o ideal e adicionar login e politicas por usuario.
