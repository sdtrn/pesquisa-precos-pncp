# Especificação de Design: Autenticação Segura, RBAC, Notificações por E-mail e Histórico de Auditoria Geral (Pesquisa de Preços PNCP)

- **Data:** 08/11/2026
- **Status:** Atualizado conforme diretrizes do Usuário (Pronto para Aprovação)
- **Autor:** Antigravity & Sérgio Dantas Torres
- **Localização:** `docs/superpowers/specs/2026-11-08-autenticacao-rbac-auditoria-design.md`

---

## 1. Contexto e Motivação

O **Pesquisa de Preços no PNCP (Edição Web Vercel)** é uma **iniciativa pessoal e independente** desenvolvida por **Sérgio Dantas Torres** para apoio técnico à pesquisa de preços em Atas de Registro de Preços (Lei nº 14.133/2021 e IN SEGES/ME nº 65/2021), sem vínculo institucional, representação ou uso de credenciais corporativas.

Para compartilhar o acesso com colegas com **segurança máxima e rastreabilidade**, o sistema precisa de:
1. **Autenticação Segura e RBAC:** Acesso protegido por login, com o administrador principal (`sergiodantastorres@gmail.com`) pré-cadastrado e moderação prévia obrigatória para novos usuários.
2. **Auto-cadastro Aberto com Aprovação Manual:** Qualquer pessoa pode solicitar acesso informando nome, qualquer e-mail válido e senha, ficando bloqueada com status **Pendente** até aprovação do Administrador.
3. **Notificações Transacionais por E-mail:** Envio via SMTP Gmail (`sergiodantastorres@gmail.com`) alertando o Administrador (`sergiodantastorres@gmail.com`) a cada nova solicitação de acesso e notificando o solicitante quando sua conta for aprovada.
4. **Histórico Geral de Auditoria e Acessos (Exclusivo Admin):** Registro completo no banco de todas as consultas realizadas e logins efetuados, acessível exclusivamente ao administrador na rota `/historico`, bloqueado (`HTTP 403`) para usuários comuns.
5. **Interface Moderna e Acessível (UI/UX):** Telas de Login, Cadastro, Gestão de Usuários e Auditoria construídas seguindo as diretrizes das skills `ui-ux-pro-max` e `frontend-design` sobre a identidade visual azul-marinho e dourado (`#1B365D` / `#D4AF37`) do sistema.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos
- **Camadas de Acesso (RBAC):**
  - **`admin` (`sergiodantastorres@gmail.com`):** Acesso total às pesquisas, exportações, Gestão de Usuários (`/usuarios`) e Histórico Geral de Auditoria e Acessos (`/historico`). Senha inicial: `Recife2026@`.
  - **`consulta` (Demais usuários aprovados):** Acesso completo às funcionalidades de pesquisa de preços no PNCP, saneamento estatístico e exportações (`.xlsx`, `.pdf`, `.csv`), sem acesso a `/usuarios`, `/historico` ou às APIs administrativas.
- **Auto-cadastro com Moderação Prévia:**
  - Qualquer e-mail válido pode ser utilizado no formulário de `/cadastro` (sem restrição de domínio).
  - Contas novas são gravadas com `perfil = 'consulta'` e `ativo = FALSE`.
  - Ao tentar logar antes da aprovação, o usuário recebe mensagem clara informando que sua solicitação aguarda aprovação do Administrador.
  - Um e-mail de alerta é enviado imediatamente para `sergiodantastorres@gmail.com` com os dados do solicitante e link para `/usuarios`.
- **Notificação de Aprovação ao Usuário:**
  - Ao clicar em **Aprovar Acesso** em `/usuarios` (`ativo: FALSE -> TRUE`), um e-mail HTML + Texto é enviado ao usuário informando a liberação e o link de `/login` (com orientações de entregabilidade/Spam).
- **Histórico Geral de Auditoria e Acessos (Exclusivo Admin):**
  - **Consultas (`pncp_historico_auditoria`):** Grava automaticamente cada execução de `/api/pesquisar` com: usuário (`id`, `nome`, `email`, `perfil`), data e hora no fuso `America/Recife`, descrição do objeto, termos de busca, escopo de órgãos, região/UF, filtro de municípios ≥ R$ 1 bi, critério de classificação, modo de normalização, período aplicado, total de candidatos encontrados, total selecionados no Top 20, total descartados, média calculada, duração em segundos, status, IP/User-Agent resumido e eventual erro.
  - **Logins/Acessos (`pncp_acessos_log`):** Grava logins bem-sucedidos, tentativas bloqueadas (conta pendente/senha inválida) com e-mail informado, data/hora (`America/Recife`), IP e User-Agent.
  - Tela `/historico` com duas abas ("Consultas Realizadas" e "Registros de Acesso"), busca/filtros e modal com Dossiê Técnico completo.
- **Segurança em Profundidade:**
  - Tabelas isoladas com prefixo `pncp_` (`pncp_usuarios`, `pncp_historico_auditoria`, `pncp_acessos_log`) na instância Neon PostgreSQL já existente.
  - Hash de senha com `scrypt` (`crypto.scryptSync` + salt aleatório de 16 bytes por usuário + `crypto.timingSafeEqual`).
  - Sessão via cookie `HttpOnly`, `Secure` (em produção), `SameSite=Lax`, assinado com **HMAC-SHA256** via Web Crypto API (compatível com Edge Middleware e Node.js), contendo `{ uid, perfil, exp }` e expiração de 7 dias, **sempre revalidado contra o banco** (`ativo = TRUE` e `perfil` atualizado) nas rotas de API e Server Components.
  - Proteção anti-CSRF por verificação de `Origin`/`Host` ou `SameSite=Lax`, cabeçalhos seguros e rate-limiting básico em memória / proteção contra enumeração no login.
  - Aprovação feita exclusivamente via `POST` autenticado por Admin no painel `/usuarios` (evitando aprovação acidental por robôs leitores de links em e-mails).

### Não-Objetivos
- Uso de e-mail institucional (`@recife.pe.gov.br`) ou vinculação oficial com órgãos públicos.
- Criação de um segundo banco de dados pago ou provedor de auth externo (Clerk/Auth0).

### Anti-Objetivos
- Nunca permitir que usuários com `ativo = FALSE` acessem a aplicação ou executem `/api/pesquisar`.
- Nunca permitir que usuários `consulta` acessem `/historico`, `/usuarios`, `/api/historico` ou `/api/usuarios` (devem receber `HTTP 403`).
- Nunca permitir desativar ou rebaixar o administrador principal (`sergiodantastorres@gmail.com`).
- Nunca exibir senhas em texto puro em logs, respostas de API ou e-mails.

---

## 3. Diretrizes de Design UI/UX (`frontend-design` + `ui-ux-pro-max`)

### 3.1. Direção Estética & Tokens
- **Paleta:** Identidade Navy & Brass existente no projeto — Azul Marinho Profundo (`#0F2442` / `#1B365D`), Dourado Institucional (`#B59410` / `#D4AF37`), Fundos claros `#F8FAFC` / `#FFFFFF` e suporte completo a Dark Mode (`#0B1120` / `#111827`). Sem gradientes genéricos roxos/rosa e sem emojis como ícones (uso estrito de ícones SVG `lucide-react`).
- **Tipografia:** `Plus Jakarta Sans` (títulos), `IBM Plex Sans` (interface e labels legíveis) e `JetBrains Mono` (datas/horas, IPs e métricas de auditoria).
- **Layout das Telas de Autenticação (`/login` e `/cadastro`):**
  - Desktop (`lg+`): Layout **Split-Screen assimétrico**. À esquerda, painel editorial em azul-marinho profundo (`#0F2442` → `#1B365D`) com malha sutil em dourado, apresentando a identidade do sistema, os pilares de auditoria (R1–R7, Lei nº 14.133/2021) e o aviso de iniciativa pessoal independente de Sérgio Dantas Torres. À direita, superfície de formulário limpa e de alto contraste com foco total na entrada segura.
  - Mobile: Cartão único centralizado responsivo (`375px+`), com alvos táteis mínimos de `44×44px` e alternância de tema claro/escuro preservada.
- **Acessibilidade em Autenticação (WCAG 2.2 AA):**
  - Sumário de erro focável (`role="alert"`, `tabIndex={-1}`, `aria-live="polite"`) no topo do formulário ao falhar validação/login.
  - Labels visíveis associadas (`htmlFor`), `autoComplete="email"`, `"current-password"` / `"new-password"` (compatível com gerenciadores de senhas, sem bloquear `paste`).
  - Botão acessível para mostrar/ocultar senha (`aria-label`) e anéis de foco visíveis (`focus-visible:ring-2`).
  - Aviso claro na tela `/cadastro` sobre a moderação prévia do Administrador e envio de confirmação por `sergiodantastorres@gmail.com`.

---

## 4. Arquitetura de Banco de Dados (`PostgreSQL / Neon`)

### 4.1. `pncp_usuarios`
```sql
CREATE TABLE IF NOT EXISTS pncp_usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) NOT NULL DEFAULT 'consulta',
    ativo BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2. `pncp_historico_auditoria`
```sql
CREATE TABLE IF NOT EXISTS pncp_historico_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES pncp_usuarios(id) ON DELETE SET NULL,
    usuario_nome VARCHAR(255),
    usuario_email VARCHAR(255),
    usuario_perfil VARCHAR(20),
    descricao_objeto TEXT NOT NULL,
    termos_busca TEXT,
    escopo_orgaos VARCHAR(120),
    regiao_ou_uf VARCHAR(60),
    apenas_municipios_bilionarios BOOLEAN,
    status_ata VARCHAR(60),
    tipo_data VARCHAR(60),
    periodo_pesquisa VARCHAR(100),
    criterio_classificacao VARCHAR(50),
    modo_normalizacao VARCHAR(50),
    total_atas_varridas INT DEFAULT 0,
    total_encontrados INT DEFAULT 0,
    total_selecionados INT DEFAULT 0,
    total_descartados INT DEFAULT 0,
    media_estimada NUMERIC(18,4),
    unidade_referencia VARCHAR(40),
    duracao_segundos NUMERIC(8,2),
    ip_origem VARCHAR(100),
    user_agent VARCHAR(255),
    status VARCHAR(50) DEFAULT 'sucesso',
    erro_mensagem TEXT,
    executado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4.3. `pncp_acessos_log`
```sql
CREATE TABLE IF NOT EXISTS pncp_acessos_log (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES pncp_usuarios(id) ON DELETE SET NULL,
    email_informado VARCHAR(255) NOT NULL,
    usuario_nome VARCHAR(255),
    evento VARCHAR(50) NOT NULL, -- 'LOGIN_SUCESSO', 'LOGIN_PENDENTE', 'LOGIN_FALHA', 'CADASTRO_SOLICITADO', 'LOGOUT'
    ip_origem VARCHAR(100),
    user_agent VARCHAR(255),
    detalhes TEXT,
    ocorrido_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4.4. Carga Inicial (Seed Idempotente)
- Garante que `sergiodantastorres@gmail.com` exista com `nome = 'Sérgio Dantas Torres'`, `perfil = 'admin'`, `ativo = TRUE` e hash `scrypt` da senha `Recife2026@` (se ainda não existir na tabela).

---

## 5. Módulos e Rotas

- **`src/lib/server/session-edge.ts`:** Utilitário compatível com Edge Runtime e Node.js usando Web Crypto API (`crypto.subtle`) para assinar e verificar o token de sessão `pncp_sessao` via HMAC-SHA256.
- **`src/lib/server/db.ts`:** Pool PostgreSQL (`pg`) para Neon, inicialização idempotente das 3 tabelas + seed do admin, hash seguro (`crypto.scryptSync` + salt aleatório), queries tipadas de usuários, histórico de pesquisas e log de acessos.
- **`src/lib/server/auth.ts`:** Helpers para API routes e Server Components (`obterUsuarioLogado`, `exigirAutenticado`, `exigirAdmin`, extração segura de IP/User-Agent).
- **`src/lib/server/email.ts`:** Templates HTML + Texto Puro e envio via `nodemailer` (`smtp.gmail.com:465` SSL usando `sergiodantastorres@gmail.com`):
  1. Alerta para `sergiodantastorres@gmail.com` quando novo usuário solicita cadastro.
  2. Confirmação para o usuário quando o acesso é aprovado pelo Administrador.
- **Rotas de API:**
  - `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/cadastro`, `GET /api/auth/me`
  - `GET /api/usuarios`, `POST /api/usuarios/[id]/toggle-status`, `POST /api/usuarios/[id]/alterar-perfil` (restritas a `admin`)
  - `GET /api/historico` (restrita a `admin`, retorna pesquisas e logs de acesso com paginação/filtros)
  - `POST /api/pesquisar` e `POST /api/parse-requisitos` e `GET/POST /api/arquivos-ata`: protegidas por autenticação (`ativo = TRUE`), gravando auditoria completa em `pncp_historico_auditoria` ao concluir `/api/pesquisar`.
- **Páginas & Componentes UI:**
  - `src/middleware.ts`: Protege rotas de página (`/`, `/usuarios`, `/historico`) e rotas de API (`/api/pesquisar`, `/api/usuarios`, `/api/historico`, `/api/parse-requisitos`, `/api/arquivos-ata`), redirecionando anônimos para `/login` e bloqueando não-admins em `/usuarios` e `/historico`.
  - `src/app/login/page.tsx`, `src/app/cadastro/page.tsx`
  - `src/app/usuarios/page.tsx` (Gestão de usuários exclusiva Admin)
  - `src/app/historico/page.tsx` (Auditoria de Consultas & Log de Acessos exclusiva Admin)
  - `src/components/HeaderInstitucional.tsx` & `src/app/page.tsx`: Exibe badge do usuário logado, botão Sair, e links para **Auditoria Geral** (`/historico`) e **Usuários** (`/usuarios`) visíveis apenas para `admin`.

---

## 6. Variáveis de Ambiente (`.env.local` e Vercel)
- `DATABASE_URL`: String de conexão Neon PostgreSQL.
- `SESSION_SECRET`: Chave secreta forte para assinatura HMAC-SHA256.
- `SMTP_HOST`: `smtp.gmail.com`
- `SMTP_PORT`: `465`
- `SMTP_USER`: `sergiodantastorres@gmail.com`
- `SMTP_PASS`: `vjgb icgf thte dzqb`
- `ADMIN_EMAIL`: `sergiodantastorres@gmail.com`
- `APP_URL`: URL base da aplicação (ex: `https://pesquisa-precos-pncp.vercel.app`, com fallback automático para o `origin`/`host` da requisição).
