# 🤖 Bot de Venda de Contos via WhatsApp

Automação completa para vender contos pelo WhatsApp com verificação de Pix por IA.

**Funciona assim:**
1. Lead manda mensagem → bot responde com os dados do Pix
2. Lead paga e envia o comprovante (foto ou PDF)
3. IA verifica data, valor e destinatário
4. Se válido → bot entrega o link do conto automaticamente
5. Se suspeito → bot avisa e pede novo envio

---

## 🛠️ Configuração (passo a passo)

### PASSO 1 — Criar conta no GitHub e subir o projeto

1. Acesse [github.com](https://github.com) e crie uma conta gratuita
2. Clique em **New repository** (botão verde)
3. Nome: `bot-contos` | Tipo: **Private** | Clique em **Create repository**
4. Faça upload de todos estes arquivos (botão "uploading an existing file")
5. Clique em **Commit changes**

---

### PASSO 2 — Hospedar o seu conto

Coloque o arquivo do conto (PDF ou página web) em algum lugar acessível por link.

**Opção mais fácil:** Google Drive
1. Suba o PDF do conto no Google Drive
2. Clique com botão direito → **Compartilhar** → **Qualquer pessoa com o link**
3. Copie o link — este é o seu `CONTENT_URL`

**Opção mais profissional:** Hospedar uma página simples na própria Vercel (pode adicionar depois)

---

### PASSO 3 — Criar conta na Vercel e fazer o deploy

1. Acesse [vercel.com](https://vercel.com) e clique em **Sign Up with GitHub**
2. Clique em **Add New Project**
3. Selecione o repositório `bot-contos` que você criou
4. Clique em **Deploy** — a Vercel vai publicar seu bot

Após o deploy, você verá uma URL como:
```
https://bot-contos-XXXXX.vercel.app
```
**Guarde esta URL** — você vai precisar dela no Passo 5.

---

### PASSO 4 — Criar o banco de dados (Vercel KV)

O KV guarda o estado de cada lead (se já pagou, se está esperando, etc.)

1. No painel da Vercel, clique no seu projeto
2. Vá em **Storage** → **Create Database** → **KV**
3. Clique em **Create** (o plano gratuito é suficiente)
4. Vá em **Settings** do KV → copie as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`

---

### PASSO 5 — Configurar as variáveis de ambiente

1. No painel da Vercel, vá no seu projeto → **Settings** → **Environment Variables**
2. Adicione cada variável abaixo clicando em **Add**:

| Nome | Valor | Exemplo |
|------|-------|---------|
| `CONTO_TITLE` | Nome do seu conto | `A Noite que Não Passou` |
| `CONTENT_URL` | Link do arquivo | `https://drive.google.com/...` |
| `PIX_KEY` | Sua chave Pix | `seu@email.com` |
| `PIX_VALUE` | Preço (com ponto) | `9.90` |
| `PIX_RECIPIENT_NAME` | Nome EXATO no Pix | `SEU NOME COMPLETO` |
| `UAZAPI_URL` | URL do seu UazAPI | `https://seu-bot.railway.app` |
| `UAZAPI_INSTANCE` | Nome da instância | `minha-instancia` |
| `UAZAPI_TOKEN` | Token do UazAPI | `abc123...` |
| `ANTHROPIC_API_KEY` | Chave da Anthropic | `sk-ant-...` |
| `KV_REST_API_URL` | (copiada do Passo 4) | |
| `KV_REST_API_TOKEN` | (copiada do Passo 4) | |

3. Após adicionar todas, vá em **Deployments** → clique nos três pontinhos → **Redeploy**

---

### PASSO 6 — Configurar o UazAPI

O UazAPI é o servidor que conecta ao seu WhatsApp. Siga a documentação oficial para instalar no Railway (gratuito):

👉 [Documentação UazAPI](https://github.com/uazapi/uazapi)

Após instalar e conectar seu número:

1. No painel do UazAPI, vá em **Configurações** → **Webhook**
2. Cole a URL do seu bot:
```
https://bot-contos-XXXXX.vercel.app/api/webhook
```
3. Ative os eventos: `messages.upsert`
4. Salve

---

### PASSO 7 — Obter a chave da Anthropic (IA)

A Anthropic oferece créditos gratuitos para novos cadastros (suficientes para muitos usos).

1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. Crie uma conta
3. Vá em **API Keys** → **Create Key**
4. Copie a chave e cole na variável `ANTHROPIC_API_KEY` na Vercel

---

## ✅ Testando

Mande uma mensagem para o número conectado no UazAPI.
O bot deve responder com os dados do Pix.

Envie um comprovante de teste (use um Pix real que você fez para si mesmo para testar).

---

## 📁 Estrutura do projeto

```
bot-contos/
├── api/
│   └── webhook.js      ← ponto de entrada (recebe mensagens)
├── lib/
│   ├── kv.js           ← banco de dados (estado dos leads)
│   ├── uazapi.js       ← envio de mensagens no WhatsApp
│   └── verify.js       ← IA que analisa os comprovantes
├── .env.example        ← template das variáveis de ambiente
├── package.json
├── vercel.json
└── README.md
```

---

## ❓ Dúvidas comuns

**O nome do destinatário no Pix precisa ser exato?**
A IA aceita variações de maiúsculas/minúsculas, mas o nome precisa estar presente no comprovante. Use o nome exatamente como aparece na sua conta bancária.

**Posso vender mais de um conto?**
Sim! Para isso, precisamos adaptar o bot para ter um menu de seleção. Me conta e montamos essa versão.

**O lead pode burlar comprando uma vez e usando o link sempre?**
O link do conteúdo é o mesmo para todos. Para proteção avançada (link único por comprador), você precisaria de um sistema de geração de links — podemos adicionar isso depois.
