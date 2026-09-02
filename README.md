# finZ

Planner financeiro pessoal em React + TypeScript + Supabase — a lógica de uma planilha de
controle financeiro (controle mensal, metas, wishlist, comparativo anual), só que multiusuário,
com banco de verdade e interface em português do Brasil.

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, componentes no estilo shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Row Level Security). Não existe servidor próprio
- **Estado:** Zustand (sessão, tema, período) · **Rotas:** React Router
- **Gráficos:** Recharts · **Animações:** Motion (Framer Motion)
- **Formulários:** React Hook Form + Zod · **Testes:** Vitest + Testing Library

---

## 1. Passo a passo para rodar

### 1.1 Pré-requisitos

- Node 18+ e npm
- Uma conta no [Supabase](https://supabase.com) (o plano gratuito basta)

### 1.2 Criar o projeto no Supabase

1. Acesse <https://supabase.com/dashboard> → **New project**.
2. Escolha nome, senha do banco e a região mais próxima (ex.: _South America (São Paulo)_).
3. Espere o provisionamento terminar (~2 min).

### 1.3 Rodar as migrations

As migrations estão em `supabase/migrations/`, **na ordem em que devem ser executadas**:

| Arquivo                 | O que faz                                                                 |
| ----------------------- | ------------------------------------------------------------------------- |
| `0001_schema.sql`       | Tabelas, enums, índices e a trava de 10 metas por usuário                 |
| `0002_rls.sql`          | Habilita RLS e cria as policies (`user_id = auth.uid()`)                  |
| `0003_views.sql`        | Funções SQL dos agregados (resumo do mês, categorias, comparativo anual…) |
| `0004_seed_trigger.sql` | Trigger que cria o profile e popula categorias/formas de pagamento padrão |

**Opção A — pelo painel (mais simples):** SQL Editor → **New query** → cole o conteúdo de cada
arquivo, na ordem, e clique em _Run_.

**Opção B — pela CLI:**

```bash
npm install -g supabase           # se ainda não tiver
supabase login
supabase link --project-ref <SEU_PROJECT_ID>
supabase db push                  # aplica tudo que está em supabase/migrations
```

### 1.4 Configurar a autenticação

No painel do Supabase, em **Authentication → Providers**:

- **Email**: já vem ligado. Para testar sem confirmar e-mail, desligue _Confirm email_
  em _Authentication → Sign In / Providers → Email_.
  O finZ entra **só com e-mail e senha**. Não há login social: o componente e a
  chamada de OAuth existiam no código sem nenhuma tela que os alcançasse — uma
  função que o repositório aparentava ter e que nunca funcionou —, e foram
  removidos em vez de ligados.

### 1.5 Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha com os dados de **Project Settings → API**:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> A `anon key` é pública por design — quem protege os dados é a RLS. **Nunca** coloque a
> `service_role key` no `.env` do frontend: ela ignora RLS.

### 1.6 Rodar

```bash
npm install
npm run dev       # http://localhost:5173
```

Outros scripts:

```bash
npm run build       # build de produção
npm run preview     # serve o build
npm run test        # testes das funções de cálculo + tela do controle mensal
npm run lint        # typecheck (tsc --noEmit)
npm run types:gen   # regenera src/lib/database.types.ts a partir do banco
```

Ao criar a primeira conta, o trigger `handle_new_user` já cria o perfil, as **formas de
pagamento** (Dinheiro, Pix, Débito, Boleto, Crédito) e as **categorias** padrão (Contas,
Saúde, Lazer, Transporte, Vestuário, Despesas eventuais, iFood, Mercado, Assinaturas,
Academia, Presentes, Desenvolvimento, Cartões).

---

## 2. Estrutura de pastas

```
supabase/
  migrations/              SQL versionado: schema, RLS, funções de agregado e seed

src/
  components/
    ui/                    Primitivos no estilo shadcn/ui (Button, Card, Select, Table…)
    common/                Peças compartilhadas entre telas:
                             linha-planilha  -> "tabela" em grid que vira card no mobile
                             grade-editavel  -> navegação por teclado estilo planilha
                             money-input     -> input de dinheiro (texto <-> centavos)
                             numero-animado  -> número que conta ao carregar
                             donut, estrelas, seletor-periodo, estados (vazio/erro)
    layout/                Casca do app logado
                             dock            -> a ÚNICA navegação, flutuante, em toda largura
                             layout-app      -> topo, área de conteúdo e transição de página
                             paleta-comandos -> ⌘K, ou "Mais -> Buscar" no dock

  features/<dominio>/      Uma pasta por tela; cada uma com sua página, seus componentes
    auth/                    login, cadastro, guarda de rota
    landing/                 página pública
    dashboard/               painel personalizável — a pessoa move, esconde e escolhe a capa
      use-painel.ts            lê e grava o arranjo no perfil (migration 0023)
      components/              capa (gradiente), widget (moldura do modo de edição)
    monthly/                 CONTROLE MENSAL (tela principal)
      use-controle-mensal.ts   carrega o mês e concentra os updates otimistas
      exportar.ts              CSV do mês
      components/              resumo, entradas, gastos fixos, gastos, investimentos,
                               categorias, formas de pagamento, 3 donuts
    annual/                  comparativo anual (tabela + gráfico de linha)
    goals/                   wishlist + grade de metas mês a mês
    settings/                customização: categorias, formas de pagamento, metas, tema
    help/                    manual de uso

  services/                Única camada que fala com o Supabase (uma função por operação).
                           base.ts traduz erros do Postgres para mensagens em português.

  lib/
    database.types.ts      Tipos do banco (gerados por `npm run types:gen`)
    supabase.ts            Cliente único
    money.ts               Centavos <-> texto <-> BRL
    calculations.ts        Funções puras de cálculo (testadas)
    dates.ts, csv.ts, hooks.ts, otimista.ts, utils.ts

  store/                   Zustand: auth (sessão + perfil), tema, período (ano/mês)
  styles/themes.css        Os 4 temas + dark mode, só com CSS variables
```

---

## 3. Decisões que valem saber

### Dinheiro em centavos

Todo valor é `bigint` de **centavos** no banco e `number` inteiro no cliente. Nada de float
em nenhum ponto do caminho. A formatação usa
`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`; a leitura aceita
`1.234,56`, `1234,56`, `1234.56` e `R$ 1.234,56` (`parseParaCentavos`).

### Regras de cálculo (iguais no SQL e no cliente)

```
entradas  = incomes(mês) + transactions(tipo='entrada', mês)
saídas    = transactions(tipo='gasto', mês) + gastos fixos ativos
investido = goal_contributions(mês) + investments(mês) sem meta
saldo     = entradas − saídas
```

- **Gasto fixo** é cadastrado uma vez e vale para todos os meses; o que muda mês a mês é o
  “pago?”, guardado em `fixed_expense_payments` (chave única `fixed_expense_id + ano + mês`).
- **Aporte com meta** vai para `goal_contributions`; **aporte sem meta**, para `investments`.
  Assim o total investido nunca conta o mesmo dinheiro duas vezes, e a mesma célula é editável
  tanto no controle mensal quanto na grade da tela de Metas.
- No comparativo anual, meses futuros aparecem como **previsto** (já incluem os gastos fixos)
  e não entram no destaque de diferença negativa.

### Onde cada total é calculado

As funções SQL (`resumo_mensal`, `gastos_por_categoria`, `saidas_por_forma_pagamento`,
`investimentos_por_meta`, `comparativo_anual`, `resumo_metas`) são usadas pelas telas que
**não** carregam as linhas: painel, comparativo anual e metas. O controle mensal já tem tudo
em memória e faz update otimista, então recalcula localmente com `src/lib/calculations.ts` —
as duas implementações seguem exatamente a mesma regra.

### Segurança

RLS habilitada em todas as tabelas, com policy `user_id = auth.uid()` para SELECT, INSERT,
UPDATE e DELETE. As funções de agregado são `SECURITY INVOKER`: rodam com as permissões de
quem chamou, então a RLS continua valendo dentro delas. O único segredo no cliente é a
`anon key`.

### Interface

- **Mobile-first**: no celular cada linha de tabela vira um card empilhado (`linha-planilha`),
  sem scroll horizontal quebrado. A única tabela larga (grade de metas) rola dentro do próprio
  container.
- **Teclado**: `Enter` avança para a próxima célula, `Shift+Enter` volta, `↑/↓` andam na mesma
  coluna, `Esc` cancela a edição do valor.
- **Estados**: toda tela tem skeleton, estado vazio com CTA e estado de erro com “tentar novamente”.
- **Optimistic updates**: a alteração aparece na hora e é revertida com toast se o Supabase recusar.
- **Tema**: rosa, azul, verde e roxo trocados por CSS variables no `:root` (`data-tema`), mais
  dark mode (`.dark`) que combina com qualquer um deles.
- **Exportar CSV**: o mês inteiro (controle mensal) ou o ano (comparativo), com `;` e BOM para
  abrir direto no Excel em português.

---

## 4. Testes

```bash
npm run test
```

- `src/lib/money.test.ts` — conversão texto ↔ centavos e formatação BRL
- `src/lib/calculations.test.ts` — saldo, % investido, % do limite, semáforo verde/amarelo/
  vermelho, totais por categoria, resumo do mês, progresso de metas e da wishlist
- `src/features/monthly/controle-mensal-page.test.tsx` — a tela principal monta e soma
  entradas, saídas e saldo com os serviços mockados
