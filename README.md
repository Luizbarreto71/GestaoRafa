# 📦 Controle Rafa Multimarcas

Sistema de controle de estoque da loja Rafa Multimarcas. Cadastro de produtos, venda com baixa
automática de estoque, histórico completo de movimentações, relatórios em PDF/Excel/CSV e
sincronização opcional com o Google Sheets.

Categorias: 📱 Celulares · 💉 TG (Tirzepatida) · 🔊 JBL · 💻 Notebooks · 🎮 Video Games

> **Uma variável de ambiente. Um projeto. Um deploy.**
> Só a `DATABASE_URL` do Supabase é obrigatória — o resto o sistema resolve sozinho.

---

## 🚀 Começando

```bash
npm install
cp .env.example .env
```

Abra o `.env` e troque `[YOUR-PASSWORD]` pela senha do seu banco no Supabase. Só isso.

```bash
npm run db:deploy   # cria todas as tabelas
npm run db:seed     # cria as 5 categorias
npm run dev         # http://localhost:5173
```

Agora crie o usuário que vai entrar no sistema:

```bash
npm run criar-admin -- "Nome do Dono" email@dominio.com
```

O comando mostra a senha gerada na tela. Se preferir escolher a senha, passe como
terceiro argumento:

```bash
npm run criar-admin -- "Nome do Dono" email@dominio.com MinhaSenha123
```

> Rodar o comando de novo com o mesmo e-mail **troca a senha** — é assim que se
> recupera um acesso perdido.

Quer ver o sistema com dados fictícios antes de usar de verdade?
`npm run db:exemplos` cria alguns produtos e uma venda de demonstração.

### Onde achar a DATABASE_URL

No Supabase, botão **Connect** no topo da tela → aba **ORMs** → **Prisma**. Copie a linha
`DATABASE_URL` e troque `[YOUR-PASSWORD]` pela senha do banco.

Use a URL do **Session pooler** — a que termina em `:5432/postgres`. Ela serve tanto para o
sistema rodar quanto para criar as tabelas, por isso basta uma.

---

## ☁️ Publicar na Vercel

1. Importe o repositório na Vercel. Não precisa configurar nada — o `vercel.json` já cuida do
   build, das rotas e da API.
2. Em **Settings → Environment Variables**, adicione a `DATABASE_URL` (a mesma do `.env`).
3. Deploy.

Site e API ficam no mesmo endereço:

```
https://seu-app.vercel.app        → o sistema
https://seu-app.vercel.app/api    → a API
```

Se ainda não criou as tabelas no banco de produção, rode uma vez com o `.env` local apontando
para lá:

```bash
npm run db:deploy && npm run db:seed
```

---

## 📁 Como o projeto é organizado

```
GestaoRafa/
├── api/index.ts        # porta de entrada da API na Vercel
│
├── server/             # o backend inteiro — um arquivo por assunto
│   ├── app.ts          # monta a API e liga as rotas
│   ├── db.ts           # conexão com o banco + log de auditoria
│   ├── core.ts         # erros, validação, paginação, datas
│   ├── auth.ts         # login, tokens, proteção de rota
│   ├── produtos.ts     # cadastro, busca, estoque, fotos
│   ├── vendas.ts       # venda e cancelamento
│   ├── movimentacoes.ts# histórico de entradas e saídas
│   ├── cadastros.ts    # categorias, fornecedores, clientes, usuários
│   ├── dashboard.ts    # cards, gráfico e alertas
│   ├── relatorios.ts   # os 6 relatórios
│   ├── exportar.ts     # gera PDF, Excel e CSV
│   ├── sistema.ts      # importar planilha, backup, Google Sheets
│   └── planilha.ts     # Google Sheets
│
├── src/                # o frontend (React)
│   ├── pages/          # Login, Dashboard, Estoque, Vendas…
│   ├── components/     # ui/, layout/, products/, sales/, settings/
│   ├── hooks/          # React Query
│   ├── services/       # chamadas à API
│   ├── contexts/       # login, tema, avisos
│   └── lib/            # api, formatação, modo offline
│
├── prisma/schema.prisma
└── .env                # ← a única configuração
```

Cada arquivo de `server/` tem as rotas e as regras daquele assunto juntas. Para mexer em venda,
você abre `server/vendas.ts` — e acabou.

### Comandos

```bash
npm run dev          # site + API na mesma porta (5173)
npm run dev:api      # só a API, em :4000, se quiser testar com curl/Insomnia
npm run build        # gera a versão de produção
npm run typecheck    # confere os tipos do frontend e do servidor

npm run db:deploy    # cria/atualiza as tabelas
npm run db:seed      # cria as categorias
npm run db:exemplos  # produtos e venda de demonstração (opcional)
npm run criar-admin  # cria um administrador / troca a senha de um existente
npm run db:studio    # abre o Prisma Studio para ver o banco
npm run db:migrate   # cria uma migration nova (depois de mexer no schema)
```

---

## 🧭 O que o sistema faz

**Dashboard** — total de produtos, itens em estoque, vendidos hoje, valor do estoque (custo e
venda), produtos com estoque baixo, faturamento e lucro do mês, gráfico de 7/14/30 dias, últimas
vendas e distribuição por categoria.

**Estoque** — tabela com foto, produto, categoria, modelo, quantidade, custo, venda, fornecedor e
status. Pesquisa em tempo real, filtros, ordenação por qualquer coluna, paginação. Botões de
editar, excluir, ajustar estoque e registrar venda. No celular vira lista de cards.

**Registrar venda** — cliente, telefone, produto, quantidade, forma de pagamento (Pix, Dinheiro,
Débito, Crédito, Transferência), valor, data e observações. Ao confirmar, na mesma transação:

1. O estoque baixa (com trava contra duas vendas simultâneas).
2. Zerando o estoque, o produto vira *Vendido*.
3. O cliente é reaproveitado pelo telefone, ou criado.
4. Entra uma movimentação de **Saída**.
5. A linha vai para a planilha do Google, se estiver ligada.

**Movimentações** — histórico de entradas, saídas, ajustes e exclusões, com data, usuário,
quantidade, saldo, produto e motivo.

**Relatórios** — Estoque · Vendas · Por categoria · Por fornecedor · Por período · Movimentações.
Todos em **PDF**, **Excel** e **CSV**, com resumo de totais, faturamento e lucro.

**Busca instantânea** — tecla <kbd>/</kbd> em qualquer tela. Procura por IMEI, modelo, nome,
marca, fornecedor, número de série, código de barras e cliente.

**Alertas** — sino no topo com produtos de estoque baixo e zerados; valor do estoque atualizado
de minuto em minuto.

**Configurações** — fornecedores, usuários (administrador/operador), troca de senha, backup em
JSON, importação de planilha, status do Google Sheets, fila offline e tema claro/escuro.

**Extras** — fotos (arrastar e soltar), leitor de código de barras pela câmera, importação e
exportação em Excel, modo offline, histórico de alterações, logs de usuários, confirmação antes
de excluir, avisos de sucesso e erro.

---

## 🔐 Perfis de acesso

| Ação                            | Operador | Administrador |
| ------------------------------- | :------: | :-----------: |
| Cadastrar e editar produtos     |    ✅    |      ✅       |
| Registrar vendas                |    ✅    |      ✅       |
| Ajustar estoque                 |    ✅    |      ✅       |
| Ver e exportar relatórios       |    ✅    |      ✅       |
| Excluir produtos e vendas       |    ❌    |      ✅       |
| Gerenciar usuários              |    ❌    |      ✅       |
| Backup e importar planilha      |    ❌    |      ✅       |
| Ver logs de auditoria           |    ❌    |      ✅       |

O sistema não deixa remover nem rebaixar o último administrador ativo.

---

## 📊 Google Sheets (opcional)

Cada entrada, venda, alteração e exclusão vira uma linha na planilha, com: Data · Categoria ·
Produto · Marca · Modelo · Quantidade · Preço de custo · Preço de venda · Fornecedor · Status ·
Tipo da movimentação · Usuário.

1. [console.cloud.google.com](https://console.cloud.google.com) → crie um projeto.
2. Ative a **Google Sheets API**.
3. Crie uma **Conta de serviço** e gere uma **chave JSON**.
4. Copie o código da planilha da URL:
   `docs.google.com/spreadsheets/d/`**`ESTE-É-O-CÓDIGO`**`/edit`
5. **Compartilhe a planilha** com o e-mail da conta de serviço, como **Editor** — sem isso não
   funciona.
6. Preencha no `.env` e troque `GOOGLE_SHEETS_ENABLED` para `true`.

Em **Configurações → Sistema** o status aparece como *Conectado*. Se a planilha falhar, o sistema
continua funcionando normalmente. O botão **Ressincronizar** reescreve a planilha inteira a partir
do banco.

---

## 📥 Importar produtos por planilha

**Configurações → Sistema → Importar produtos → Baixar modelo**. Preencha mantendo os cabeçalhos e
envie o `.xlsx`, `.xls` ou `.csv`.

A categoria precisa ser uma das cadastradas; fornecedor novo é criado automaticamente. Linhas com
erro são listadas com o número da linha e o motivo — as outras entram normalmente.

---

## 📴 Modo offline

Sem internet, vendas e cadastros ficam numa fila no navegador e o topo mostra o aviso *Offline*.
Quando a conexão volta, a fila é enviada na ordem em que foi criada. Operações recusadas pelo
servidor (estoque insuficiente, por exemplo) saem da fila com um aviso, para não travar as demais.

Dá para ver, sincronizar na mão ou descartar a fila em **Configurações → Sistema → Modo offline**.

---

## 🧠 Decisões que valem saber

- **As fotos ficam no banco.** O navegador reduz cada imagem para no máximo 1200px (~150KB) antes
  de enviar. Isso elimina a necessidade de configurar serviço de arquivos — e é o que permite
  rodar na Vercel, onde não existe disco gravável.
- **A venda guarda o custo do momento.** Reajustar o preço de custo depois não muda o lucro que já
  foi registrado.
- **O histórico sobrevive à exclusão.** Apagar um produto mantém as movimentações dele.
- **Produto com venda não é apagado**: o estoque zera e ele é arquivado como *Vendido*, para o
  histórico financeiro continuar batendo.
- **O segredo do login é gerado sozinho** na primeira execução e guardado no banco — uma variável
  a menos para você configurar.
- **Estoque baixo usa o mínimo de cada produto**, não um número fixo igual para todos.

---

## 🆘 Se der problema

| Sintoma                                    | O que fazer                                                        |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `Can't reach database server`              | Confira a senha na `DATABASE_URL` (é a do banco, não a da conta)    |
| `Tenant or user not found`                 | Você copiou a URL errada — pegue a do **Session pooler** (`:5432`)  |
| `prepared statement already exists`         | Está usando a URL do *Transaction pooler* (`:6543`). Troque para 5432 |
| Login dá 401 com a senha certa             | Rode `npm run db:seed` para criar o administrador                   |
| Todo mundo foi deslogado de repente        | A `JWT_SECRET` mudou. Se você não definiu, apague a linha do `.env`  |
| Planilha do Google não atualiza            | Compartilhe a planilha com o e-mail da conta de serviço, como Editor |
| Câmera não abre no leitor de código        | Precisa de HTTPS (na Vercel funciona) ou `localhost`                 |
| Foto não aparece depois de salvar          | Confira se o produto foi salvo — a foto só grava junto com ele       |

---

## 🎨 Visual

Azul escuro `#0F172A` na navegação, branco e cinza claro nos fundos, verde `#16A34A` para vendas
e vermelho `#DC2626` para exclusões. Ícones [Lucide](https://lucide.dev), fonte Inter, menu
lateral recolhível, tema claro/escuro e layout responsivo no computador e no celular.

---

## 📄 Licença

Software proprietário desenvolvido para a Rafa Multimarcas.
