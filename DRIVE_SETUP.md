# Configuracao do Google Drive

O projeto suporta dois modos de acesso ao Drive:

- Conta de servico, usada para ler e gravar diretamente na pasta compartilhada.
- OAuth, usado para salvar um refresh token na tabela `drive_tokens` do Supabase.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha os valores.

Obrigatorias para o projeto:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`

Opcao A, conta de servico:

- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`

Opcao B, OAuth:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URL`

Em ambiente local, use este callback:

- `http://localhost:3000/api/drive/oauth/callback`

## Passos recomendados

1. Crie ou escolha a pasta raiz no Google Drive.
2. Coloque o ID da pasta em `GOOGLE_DRIVE_FOLDER_ID`.
3. Se usar conta de servico, compartilhe essa pasta com o email de `GOOGLE_DRIVE_CLIENT_EMAIL` com permissao de edicao.
4. Se usar OAuth, configure o redirect URI no Google Cloud e depois acesse `/api/drive/oauth/start` autenticado como usuario mestre.
5. Inicie o projeto com `npm run dev`.

## Como validar

Depois da configuracao:

- O aviso de espelho local nao deve mais aparecer se o Drive estiver acessivel.
- As rotas de combustivel passam a sincronizar `fuel_data.json` e `fuel_history.json` na pasta `combustivel` dentro da pasta raiz do Drive.
- Uploads gerais usam a raiz configurada em `GOOGLE_DRIVE_FOLDER_ID`.

## Observacoes

- Se o ambiente estiver sem Drive configurado, o sistema agora usa apenas o armazenamento local sem mostrar falso alerta.
- Se o Drive estiver configurado e ainda assim falhar, o aviso continua aparecendo porque ai o problema e real: permissao, credencial, callback OAuth ou token salvo.