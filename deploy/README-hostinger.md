# FisioGest Pro — Deploy no Hostinger

Pacote pronto para publicação em hospedagem **Hostinger Node.js** (planos Business ou superior).

---

## 1. Pré-requisitos

- Hostinger com plano que suporte **Node.js 20+**
- Banco **PostgreSQL** já provisionado (Hostinger Database, Neon, Supabase ou outro)
- Acesso SSH ao servidor (para rodar `npm install` e `npm start`)

---

## 2. Estrutura do pacote

```
deploy/
├── index.cjs                                  ← bundle do servidor (Express)
├── package.json                               ← dependências de produção
├── .env.example                               ← modelo de variáveis de ambiente
├── README-hostinger.md                        ← este arquivo
└── artifacts/
    └── fisiogest/dist/public/                 ← frontend compilado (HTML + JS + CSS)
        ├── index.html
        └── assets/
```

> ⚠️ **Importante:** mantenha esta estrutura intacta. O servidor procura o frontend em `artifacts/fisiogest/dist/public/` relativo ao diretório onde `node index.cjs` é executado.

---

## 3. Passo a passo

### 3.1. Enviar arquivos

Envie **todo o conteúdo** desta pasta (`deploy/`) para o diretório raiz da aplicação no Hostinger (geralmente `public_html/` ou o diretório configurado em **Node.js App → Application Root**) via:

- **Gerenciador de Arquivos** (descompactar o ZIP no painel)
- **FTP/SFTP**

### 3.2. Instalar dependências

No SSH, dentro do diretório onde os arquivos foram enviados:

```bash
npm install --omit=dev
```

### 3.3. Configurar variáveis de ambiente

No painel **Hostinger → Node.js App → Environment Variables**, configure (use `.env.example` como referência):

| Variável         | Obrigatória | Descrição                                                       |
|------------------|-------------|-----------------------------------------------------------------|
| `PORT`           | Sim         | Porta exposta (Hostinger geralmente injeta automaticamente)     |
| `NODE_ENV`       | Sim         | `production`                                                    |
| `DATABASE_URL`   | Sim         | String de conexão PostgreSQL                                    |
| `JWT_SECRET`     | Sim         | Chave aleatória ≥ 64 caracteres                                 |
| `CORS_ORIGIN`    | Sim         | Domínio do frontend, ex.: `https://app.suaclinica.com.br`       |
| `CLOUDINARY_URL` | Opcional    | Necessário apenas para upload de fotos/evoluções                |

> Gere o `JWT_SECRET` com:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 3.4. Configurar o entry point

No painel **Hostinger → Node.js App → Application**:

- **Entry point / Startup file:** `index.cjs`
- **Node.js version:** `20` ou superior

### 3.5. Iniciar a aplicação

```bash
npm start
```

ou clicando em **Restart App** no painel do Hostinger.

---

## 4. Pós-deploy

### 4.1. Sincronizar schema do banco (uma vez)

O bundle **não** inclui o `drizzle-kit`. Para sincronizar o schema na primeira execução, use uma das opções:

- **Opção A (recomendada):** rode `pnpm run db:push` na sua máquina local apontando `DATABASE_URL` para o banco de produção
- **Opção B:** restaure um dump do banco de desenvolvimento direto no servidor PostgreSQL

### 4.2. Verificar funcionamento

Acesse `https://seudominio.com.br/` — deve abrir a landing page. Em `/login` é possível autenticar.

Endpoint de health check da API: `GET /api/health` (deve retornar `200 OK`).

---

## 5. Atualizações futuras

Para publicar uma nova versão:

1. Gere um novo ZIP com este pacote atualizado
2. Faça backup do banco antes de subir
3. Substitua os arquivos no servidor (preserve `node_modules/` se as dependências não mudaram)
4. Reinicie a aplicação no painel

---

## 6. Solução de problemas

| Sintoma                                          | Causa provável                      | Ação                                                  |
|--------------------------------------------------|-------------------------------------|-------------------------------------------------------|
| Erro `ENOENT: index.html`                        | Estrutura de pastas alterada        | Restaurar `artifacts/fisiogest/dist/public/`          |
| Tela branca / 404 nos assets                     | Domínio CORS errado                 | Ajustar `CORS_ORIGIN`                                 |
| `Connection terminated`                          | Banco indisponível ou SSL incorreto | Verificar `DATABASE_URL` e adicionar `?sslmode=require` se necessário |
| `JWT_SECRET must be set`                         | Variável faltando                   | Configurar no painel Hostinger                        |
| Upload de fotos falha                            | `CLOUDINARY_URL` ausente            | Configurar Cloudinary                                 |
