# FisioGest Pro — Deploy no Hostinger

## Pré-requisitos

- Hostinger com plano **Node.js** (Business ou superior)
- Banco de dados **PostgreSQL** provisionado (pode ser Hostinger Database ou externo)
- Node.js **20+** selecionado no painel do Hostinger

---

## Passos para implantação

### 1. Enviar os arquivos

Envie todo o conteúdo desta pasta via **Gerenciador de Arquivos** ou **FTP** para o diretório raiz do seu domínio (normalmente `public_html/` ou o diretório configurado para Node.js no Hostinger).

### 2. Instalar dependências

No terminal SSH do Hostinger, dentro do diretório onde enviou os arquivos:

```bash
npm install
```

### 3. Configurar variáveis de ambiente

No painel do Hostinger (Node.js App → Environment Variables), configure:

| Variável       | Valor                                                |
|----------------|------------------------------------------------------|
| `PORT`         | `3000` (ou a porta padrão do Hostinger)              |
| `NODE_ENV`     | `production`                                         |
| `DATABASE_URL` | `postgresql://usuario:senha@host:5432/nome_do_banco` |
| `JWT_SECRET`   | Chave aleatória longa (mínimo 64 caracteres)         |
| `CORS_ORIGIN`  | `https://seudominio.com.br`                          |

> **Dica de segurança:** Gere o JWT_SECRET com: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### 4. Configurar o ponto de entrada

No painel do Hostinger em **Node.js → Application**, defina:

- **Entry point:** `index.cjs`
- **Node.js version:** `20` ou superior

### 5. Iniciar a aplicação

```bash
npm start
```

Ou pelo painel do Hostinger, clique em **Restart** / **Start**.

### 6. Criar as tabelas do banco de dados (primeira vez)

O servidor cria as tabelas automaticamente ao iniciar em produção. Verifique os logs para confirmar.

---

## Estrutura do pacote

```
fisiogest-pro/
├── index.cjs                        ← Servidor compilado (API + servidor de arquivos)
├── artifacts/
│   └── fisiogest/
│       └── dist/
│           └── public/              ← Frontend React compilado
├── package.json                     ← Somente dependências de produção
├── .env.example                     ← Exemplo de variáveis de ambiente
└── README-hostinger.md              ← Este arquivo
```

## Observações

- O servidor Express serve tanto a API (`/api/*`) quanto o frontend React como SPA.
- Todas as rotas não-API redirecionam para o `index.html` (React Router).
- O banco de dados PostgreSQL deve ser acessível a partir do servidor do Hostinger.
- As migrações do banco de dados são aplicadas automaticamente na inicialização.
