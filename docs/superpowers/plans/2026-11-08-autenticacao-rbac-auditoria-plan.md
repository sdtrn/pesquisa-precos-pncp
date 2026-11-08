# Autenticação Segura, RBAC, Notificações por E-mail e Histórico de Auditoria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar autenticação segura com aprovação prévia de cadastros, controle de acesso RBAC (`admin` / `consulta`), notificações via Gmail SMTP (`sergiodantastorres@gmail.com`), histórico de auditoria e acessos exclusivo do administrador e telas modernas no padrão Navy & Brass do sistema.

**Architecture:** Persistência em Neon PostgreSQL via `pg` com tabelas dedicadas (`pncp_usuarios`, `pncp_historico_auditoria`, `pncp_acessos_log`). Sessão HMAC-SHA256 compatível com Web Crypto (`Edge Middleware`) + Node.js, com revalidação em banco nas rotas protegidas e hashing de senha `scrypt` com salt aleatório por usuário. E-mails transacionais HTML + Texto via `nodemailer`. UI/UX seguindo `ui-ux-pro-max` e `frontend-design` com Split-Screen assimétrico, acessibilidade WCAG 2.2 AA e Dark Mode.

**Tech Stack:** Next.js 15 (App Router, TypeScript), PostgreSQL (Neon via `pg`), `nodemailer`, `lucide-react`, Tailwind CSS, Web Crypto API & Node `crypto`.

**Spec:** [docs/superpowers/specs/2026-11-08-autenticacao-rbac-auditoria-design.md](file:///g:/Meu%20Drive/Projetos%20Antigravity/Pesquisa%20de%20Pre%C3%A7os%20PNCP%20Vercel/docs/superpowers/specs/2026-11-08-autenticacao-rbac-auditoria-design.md)

## Global Constraints

- Administrador padrão: `sergiodantastorres@gmail.com`, senha inicial `Recife2026@`, nome `Sérgio Dantas Torres`, perfil `admin`, ativo `true`. Zero menções a e-mails corporativos (`@recife.pe.gov.br`).
- E-mail de disparo SMTP e destinatário dos alertas de cadastro: `sergiodantastorres@gmail.com` (App Password de 16 caracteres: `vjgb icgf thte dzqb`).
- Projeto declarado explicitamente como iniciativa pessoal e independente de Sérgio Dantas Torres (sem vínculo institucional).
- Qualquer e-mail válido pode solicitar cadastro (status inicial `ativo = FALSE`, perfil `consulta`).
- Perfil `consulta` só pode pesquisar preços e exportar seus resultados; não acessa `/usuarios` nem `/historico` (`HTTP 403`).
- Auditoria registra consultas em `pncp_historico_auditoria` e eventos de acesso em `pncp_acessos_log` exibidos no fuso `America/Recife`.

## Review Focus

- Bloqueio de login para usuários pendentes (`ativo = false`) com mensagem clara (`"Sua solicitação de cadastro foi realizada e aguarda aprovação do Administrador."`) e registro em `pncp_acessos_log`.
- Proteção contra auto-desativação ou alteração de perfil do administrador principal (`sergiodantastorres@gmail.com`).
- Resiliência contra falhas SMTP (cadastro/aprovação no banco não falham se o SMTP oscilar).
- Validação estrita do cookie HMAC-SHA256 tanto no Edge Middleware (`src/middleware.ts`) quanto no banco (rejeitar tokens adulterados, expirados ou de usuários desativados).
- Bloqueio estrito (`HTTP 401` / `403`) em rotas de API (`/api/pesquisar`, `/api/usuarios`, `/api/historico`, `/api/parse-requisitos`, `/api/arquivos-ata`) para não autenticados ou não administradores.

---

### Task 1: Dependências e Configuração de Ambiente

**Files:**
- Modify: `package.json`
- Modify: `.env.local`
- Check: `next.config.mjs`, `.gitignore`

**Interfaces:**
- Consumes: String `DATABASE_URL` do Neon PostgreSQL e credenciais SMTP Gmail de `sergiodantastorres@gmail.com`.
- Produces:
  - Pacotes `pg`, `@types/pg`, `nodemailer`, `@types/nodemailer` instalados no projeto (e sincronizados em `%LOCALAPPDATA%\PesquisaPrecosPNCP_Vercel_deps\node_modules` caso esse diretório exista, pois `next.config.mjs` o utiliza no resolver).
  - Script `npm test` atualizado em `package.json` para incluir `tests/server/*.test.ts`.
  - `.env.local` configurado com `DATABASE_URL`, `SESSION_SECRET`, `SMTP_HOST="smtp.gmail.com"`, `SMTP_PORT="465"`, `SMTP_USER="sergiodantastorres@gmail.com"`, `SMTP_PASS="vjgb icgf thte dzqb"`, `ADMIN_EMAIL="sergiodantastorres@gmail.com"`.

- [ ] **Step 1: Atualizar `package.json` adicionando `pg`, `@types/pg`, `nodemailer`, `@types/nodemailer` e incluindo `tests/server/*.test.ts` no script `test`**
- [ ] **Step 2: Instalar dependências (`npm install`) e sincronizar `pg`/`nodemailer` em `%LOCALAPPDATA%\PesquisaPrecosPNCP_Vercel_deps\node_modules` se existir**
- [ ] **Step 3: Atualizar `.env.local` com `DATABASE_URL`, `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ADMIN_EMAIL` (sem commitar `.env.local`)**
- [ ] **Step 4: Verificar importação de `pg` e `nodemailer` via Node e commitar `package.json` / `package-lock.json`**

---

### Task 2: Utilitário de Sessão Edge-Safe HMAC-SHA256 (`src/lib/server/session-edge.ts`)

**Files:**
- Create: `src/lib/server/session-edge.ts`
- Create: `tests/server/session-edge.test.ts`

**Interfaces:**
- Consumes: `process.env.SESSION_SECRET`
- Produces:
  - `export const COOKIE_NAME = "pncp_sessao";`
  - `export const DEFAULT_TTL_SECONDS = 7 * 24 * 3600;`
  - `export type PerfilUsuario = "admin" | "consulta";`
  - `export interface PayloadSessao { uid: number; email: string; nome: string; perfil: PerfilUsuario; exp: number; }`
  - `export async function assinarTokenSessao(payload: Omit<PayloadSessao, "exp">, ttlSegundos?: number, secretOverride?: string): Promise<string>`
  - `export async function verificarTokenSessao(token?: string | null, secretOverride?: string): Promise<PayloadSessao | null>`
  - `export function extrairTokenDosCookies(cookieHeader?: string | null): string | null`

- [ ] **Step 1: Escrever `tests/server/session-edge.test.ts` testando assinatura válida, rejeição de assinatura adulterada, rejeição de payload adulterado, expiração (`ttlSegundos <= 0`), token malformado e `extrairTokenDosCookies`**
- [ ] **Step 2: Executar `node --import ./register.js --test tests/server/session-edge.test.ts` e verificar falha (RED)**
- [ ] **Step 3: Implementar `src/lib/server/session-edge.ts` usando exclusivamente Web Crypto API (`globalThis.crypto.subtle`) e comparação em tempo constante**
- [ ] **Step 4: Executar `node --import ./register.js --test tests/server/session-edge.test.ts` (GREEN) e commitar**

---

### Task 3: Banco de Dados Neon, Migrações, Seed Admin e Hashing (`src/lib/server/db.ts`)

**Files:**
- Create: `src/lib/server/db.ts`
- Create: `tests/server/db.test.ts`

**Interfaces:**
- Consumes: `process.env.DATABASE_URL`, `process.env.ADMIN_EMAIL`
- Produces:
  - `export const ADMIN_PRINCIPAL_EMAIL = "sergiodantastorres@gmail.com";`
  - `export const ADMIN_PRINCIPAL_SENHA_INICIAL = "Recife2026@";`
  - `export const ADMIN_PRINCIPAL_NOME = "Sérgio Dantas Torres";`
  - `export interface UsuarioPncp { id: number; email: string; nome: string; perfil: "admin" | "consulta"; ativo: boolean; ultimo_login: string | Date | null; criado_em: string | Date; }`
  - `export interface RegistroAuditoriaPncp { id: number; usuario_id: number | null; usuario_nome: string | null; usuario_email: string | null; usuario_perfil: string | null; descricao_objeto: string; termos_busca: string | null; escopo_orgaos: string | null; regiao_ou_uf: string | null; apenas_municipios_bilionarios: boolean | null; status_ata: string | null; tipo_data: string | null; periodo_pesquisa: string | null; criterio_classificacao: string | null; modo_normalizacao: string | null; total_atas_varridas: number; total_encontrados: number; total_selecionados: number; total_descartados: number; media_estimada: number | null; unidade_referencia: string | null; duracao_segundos: number | null; ip_origem: string | null; user_agent: string | null; status: string; erro_mensagem: string | null; executado_em: string | Date; }`
  - `export interface RegistroAcessoPncp { id: number; usuario_id: number | null; email_informado: string; usuario_nome: string | null; evento: string; ip_origem: string | null; user_agent: string | null; detalhes: string | null; ocorrido_em: string | Date; }`
  - `export function hashSenha(senhaPlana: string): string`
  - `export function verificarSenha(senhaPlana: string, hashArmazenado: string): boolean`
  - `export function carregarEnvLocal(): void`
  - `export function getPool(): Pool`
  - `export async function inicializarBancoPncp(): Promise<void>`
  - `export async function buscarUsuarioPorEmail(email: string): Promise<(UsuarioPncp & { senha_hash: string }) | null>`
  - `export async function buscarUsuarioPorId(id: number): Promise<UsuarioPncp | null>`
  - `export async function criarSolicitacaoUsuario(dados: { nome: string; email: string; senhaPlana: string }): Promise<UsuarioPncp>`
  - `export async function listarUsuariosPncp(): Promise<UsuarioPncp[]>`
  - `export async function alternarStatusUsuario(id: number): Promise<{ usuario: UsuarioPncp; foiAprovadoAgora: boolean }>`
  - `export async function alterarPerfilUsuario(id: number, novoPerfil: "admin" | "consulta"): Promise<UsuarioPncp>`
  - `export async function atualizarUltimoLogin(id: number): Promise<void>`
  - `export async function registrarAuditoriaPesquisa(dados: Omit<RegistroAuditoriaPncp, "id" | "executado_em">): Promise<number | null>`
  - `export async function registrarLogAcesso(dados: Omit<RegistroAcessoPncp, "id" | "ocorrido_em">): Promise<number | null>`
  - `export async function listarHistoricoAuditoria(limite?: number): Promise<RegistroAuditoriaPncp[]>`
  - `export async function listarLogsAcesso(limite?: number): Promise<RegistroAcessoPncp[]>`

- [ ] **Step 1: Escrever `tests/server/db.test.ts` testando `hashSenha` / `verificarSenha` (`scrypt` + salt único + rejeição de senha incorreta), inicialização das tabelas no Neon, seed garantido de `sergiodantastorres@gmail.com` (`admin`, `ativo=true`, senha `Recife2026@`) e proteção contra desativação/rebaixamento do admin principal**
- [ ] **Step 2: Executar `node --import ./register.js --test tests/server/db.test.ts` e verificar falha (RED)**
- [ ] **Step 3: Implementar `src/lib/server/db.ts`**
- [ ] **Step 4: Executar `node --import ./register.js --test tests/server/db.test.ts` (GREEN) e commitar**

---

### Task 4: Camada de Autenticação Server-Side (`src/lib/server/auth.ts`)

**Files:**
- Create: `src/lib/server/auth.ts`
- Create: `tests/server/auth.test.ts`

**Interfaces:**
- Consumes: `session-edge.ts`, `db.ts`
- Produces:
  - `export class AuthError extends Error { status: 401 | 403; constructor(message: string, status: 401 | 403); }`
  - `export function extrairMetadadosRequisicao(req: Request): { ip: string; userAgent: string; originUrl: string }`
  - `export async function obterUsuarioLogado(req: Request, deps?: { buscarPorId?: typeof buscarUsuarioPorId }): Promise<UsuarioPncp | null>`
  - `export async function exigirAutenticado(req: Request, deps?: { buscarPorId?: typeof buscarUsuarioPorId }): Promise<UsuarioPncp>`
  - `export async function exigirAdmin(req: Request, deps?: { buscarPorId?: typeof buscarUsuarioPorId }): Promise<UsuarioPncp>`
  - `export function construirHeaderSetCookieSessao(token: string, maxAgeSegundos?: number): string`
  - `export function construirHeaderLimparCookieSessao(): string`

- [ ] **Step 1: Escrever `tests/server/auth.test.ts` testando `obterUsuarioLogado` (usuário ativo, usuário desativado no banco mesmo com cookie válido, sem cookie), `exigirAutenticado` (401), `exigirAdmin` (403 para `consulta`, sucesso para `admin`) e formatação de cookies `HttpOnly; SameSite=Lax`**
- [ ] **Step 2: Executar `node --import ./register.js --test tests/server/auth.test.ts` e verificar falha (RED)**
- [ ] **Step 3: Implementar `src/lib/server/auth.ts`**
- [ ] **Step 4: Executar `node --import ./register.js --test tests/server/auth.test.ts` (GREEN) e commitar**

---

### Task 5: Serviço de Notificações por E-mail (`src/lib/server/email.ts`)

**Files:**
- Create: `src/lib/server/email.ts`
- Create: `tests/server/email.test.ts`

**Interfaces:**
- Consumes: Credenciais SMTP (`sergiodantastorres@gmail.com`) do `.env.local` / `process.env`
- Produces:
  - `export const EMAIL_DISCLAIMER_INDEPENDENTE: string`
  - `export function formatarEmailNovoCadastro(dados: { nome: string; email: string; dataHora: string; appUrl?: string }): { assunto: string; texto: string; html: string }`
  - `export function formatarEmailAprovacaoUsuario(dados: { nome: string; email: string; appUrl?: string }): { assunto: string; texto: string; html: string }`
  - `export async function enviarNotificacaoNovoCadastro(dados: { nome: string; email: string; dataHora?: string; appUrl?: string }): Promise<{ enviado: boolean; mensagem: string }>`
  - `export async function enviarNotificacaoAprovacao(dados: { nome: string; email: string; appUrl?: string }): Promise<{ enviado: boolean; mensagem: string }>`

- [ ] **Step 1: Escrever `tests/server/email.test.ts` validando templates HTML e texto puro (presença de nome, e-mail, links `/usuarios` e `/login`, aviso de Spam, disclaimer de iniciativa pessoal independente de Sérgio Dantas Torres, zero menções a `@recife.pe.gov.br` e resiliência quando SMTP está ausente/falha)**
- [ ] **Step 2: Executar `node --import ./register.js --test tests/server/email.test.ts` e verificar falha (RED)**
- [ ] **Step 3: Implementar `src/lib/server/email.ts`**
- [ ] **Step 4: Executar `node --import ./register.js --test tests/server/email.test.ts` (GREEN) e commitar**

---

### Task 6: Endpoints de API (Auth, Usuários, Histórico e Integração na Pesquisa)

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/cadastro/route.ts`
- Create: `src/app/api/auth/me/route.ts`
- Create: `src/app/api/usuarios/route.ts`
- Create: `src/app/api/usuarios/[id]/toggle-status/route.ts`
- Create: `src/app/api/usuarios/[id]/alterar-perfil/route.ts`
- Create: `src/app/api/historico/route.ts`
- Modify: `src/app/api/pesquisar/route.ts`
- Modify: `src/app/api/parse-requisitos/route.ts`
- Modify: `src/app/api/arquivos-ata/route.ts`
- Create: `tests/server/api-rbac.test.ts`

**Interfaces:**
- Consumes: `session-edge.ts`, `db.ts`, `auth.ts`, `email.ts`
- Produces:
  - `POST /api/auth/login` -> `{ ok: true, usuario }` + header `Set-Cookie` (ou `403` para conta pendente, `401` para credenciais inválidas) + log em `pncp_acessos_log`.
  - `POST /api/auth/logout` -> `{ ok: true }` + limpa cookie + log `LOGOUT`.
  - `POST /api/auth/cadastro` -> aceita qualquer e-mail válido, cria com `ativo = false`, dispara `enviarNotificacaoNovoCadastro` para `sergiodantastorres@gmail.com`, registra `CADASTRO_SOLICITADO` e retorna `201`.
  - `GET /api/auth/me` -> `{ autenticado: true, usuario }` ou `401`.
  - `GET /api/usuarios`, `POST /api/usuarios/[id]/toggle-status` (dispara `enviarNotificacaoAprovacao` ao aprovar), `POST /api/usuarios/[id]/alterar-perfil` -> exclusivos `admin` (`401`/`403` caso contrário).
  - `GET /api/historico` -> exclusivo `admin`, retorna `{ consultas, acessos, resumo }`.
  - `POST /api/pesquisar`, `POST /api/parse-requisitos`, `GET|POST /api/arquivos-ata` -> exigem usuário autenticado (`exigirAutenticado`) e `/api/pesquisar` grava automaticamente registro em `pncp_historico_auditoria`.

- [ ] **Step 1: Escrever `tests/server/api-rbac.test.ts` testando fluxo de cadastro -> tentativa de login pendente (403) -> login admin (`sergiodantastorres@gmail.com`) -> listagem e aprovação de usuário -> bloqueio 403 de usuário `consulta` em `/api/usuarios` e `/api/historico` -> bloqueio de desativação do admin principal**
- [ ] **Step 2: Executar `node --import ./register.js --test tests/server/api-rbac.test.ts` e verificar falha (RED)**
- [ ] **Step 3: Implementar todas as rotas de API e atualizar `/api/pesquisar`, `/api/parse-requisitos` e `/api/arquivos-ata`**
- [ ] **Step 4: Executar `node --import ./register.js --test tests/server/api-rbac.test.ts` (GREEN) e commitar**

---

### Task 7: Telas Modernas de Login e Cadastro (`/login` e `/cadastro`)

**Files:**
- Create: `src/components/AuthSplitShell.tsx`
- Create: `src/app/login/page.tsx`
- Create: `src/app/cadastro/page.tsx`
- Create: `tests/server/ui-auth-pages.test.ts`

**Interfaces:**
- Consumes: `/api/auth/login`, `/api/auth/cadastro`
- Produces:
  - `AuthSplitShell`: Layout Split-Screen Navy (`#0F2442` / `#1B365D`) & Brass (`#D4AF37` / `#B59410`) com painel institucional à esquerda (pilares Lei nº 14.133/2021, Auditoria R1–R7, iniciativa pessoal independente de Sérgio Dantas Torres), alternância Dark Mode e container de formulário acessível à direita.
  - `/login`: Sumário de erro focável (`role="alert"`), suporte a aviso de conta pendente em destaque âmbar, campos com `autoComplete="email"` e `autoComplete="current-password"`, botão mostrar/ocultar senha (`aria-label`), link para `/cadastro`.
  - `/cadastro`: Banner de aprovação prévia obrigatória informando envio por `sergiodantastorres@gmail.com`, campos Nome Completo, E-mail (qualquer domínio válido), Senha e Confirmar Senha, estado de sucesso pós-envio e link para `/login`.

- [ ] **Step 1: Escrever `tests/server/ui-auth-pages.test.ts` verificando estrutura, atributos de acessibilidade (`role="alert"`, `autoComplete`, `aria-label`), links `/login` <-> `/cadastro` e ausência de `@recife.pe.gov.br`**
- [ ] **Step 2: Executar teste para verificar falha (RED)**
- [ ] **Step 3: Implementar `src/components/AuthSplitShell.tsx`, `src/app/login/page.tsx` e `src/app/cadastro/page.tsx`**
- [ ] **Step 4: Executar teste (GREEN) e commitar**

---

### Task 8: Painéis Administrativos (`/usuarios` e `/historico`)

**Files:**
- Create: `src/app/usuarios/page.tsx`
- Create: `src/app/historico/page.tsx`
- Create: `tests/server/ui-admin-pages.test.ts`

**Interfaces:**
- Consumes: `/api/usuarios`, `/api/usuarios/[id]/toggle-status`, `/api/usuarios/[id]/alterar-perfil`, `/api/historico`, `/api/auth/me`
- Produces:
  - `/usuarios`: Painel de Gestão de Usuários (cards de resumo Total / Ativos / Pendentes, filtro de busca, tabela com badges de perfil `Admin`/`Consulta` e status `Ativo`/`Aguardando Aprovação`, botões `Aprovar Acesso`, `Desativar`, `Tornar Admin`/`Tornar Consulta`, trava visual para `sergiodantastorres@gmail.com`, feedback de envio de e-mail).
  - `/historico`: Painel de Histórico Geral de Auditoria e Acessos exclusivo do Admin, com cards de métricas, alternância entre duas abas (`Consultas Realizadas` e `Acessos & Logins`), filtros por usuário/objeto/status e modal interativo **Dossiê Técnico de Auditoria** exibindo todos os parâmetros da consulta, estatísticas, fuso `America/Recife`, IP/User-Agent e duração.

- [ ] **Step 1: Escrever `tests/server/ui-admin-pages.test.ts` verificando componentes, colunas de auditoria, abas de consultas/acessos, modal de dossiê e proteção contra acesso de não-admin**
- [ ] **Step 2: Executar teste para verificar falha (RED)**
- [ ] **Step 3: Implementar `src/app/usuarios/page.tsx` e `src/app/historico/page.tsx`**
- [ ] **Step 4: Executar teste (GREEN) e commitar**

---

### Task 9: Middleware de Proteção Global, Integração do Header e Verificação Completa

**Files:**
- Create: `src/middleware.ts`
- Modify: `src/components/HeaderInstitucional.tsx`
- Modify: `src/app/page.tsx`
- Create: `tests/server/middleware-and-header.test.ts`

**Interfaces:**
- Consumes: `src/lib/server/session-edge.ts`, `/api/auth/me`, `/api/auth/logout`
- Produces:
  - `src/middleware.ts`: Verifica token HMAC-SHA256 via `verificarTokenSessao`. Permite rotas públicas (`/login`, `/cadastro`, `/api/auth/*`, assets estáticos). Redireciona não autenticados em páginas privadas (`/`, `/usuarios`, `/historico`) para `/login` e retorna `401` em `/api/*`. Bloqueia perfil `consulta` em `/usuarios`, `/historico`, `/api/usuarios/*` e `/api/historico` (`403` na API ou redirect para `/`). Redireciona usuários já autenticados em `/login` ou `/cadastro` para `/`.
  - `HeaderInstitucional.tsx` & `src/app/page.tsx`: Exibe identificação do usuário logado (`nome`, `email`, badge `Admin` ou `Consulta`), botões exclusivos para `admin` (**Auditoria Geral** -> `/historico` e **Usuários** -> `/usuarios`), e botão **Sair** (`POST /api/auth/logout` -> `/login`).

- [ ] **Step 1: Escrever `tests/server/middleware-and-header.test.ts` testando regras do middleware (anônimo -> `/login` ou `401`, `consulta` bloqueado em `/usuarios` e `/historico`, `admin` liberado) e controles condicionais do `HeaderInstitucional`**
- [ ] **Step 2: Executar teste para verificar falha (RED)**
- [ ] **Step 3: Implementar `src/middleware.ts` e atualizar `src/components/HeaderInstitucional.tsx` e `src/app/page.tsx`**
- [ ] **Step 4: Executar suíte completa `npm test`, `npx tsc --noEmit` e `npm run build`, verificar tudo 100% verde e commitar**
