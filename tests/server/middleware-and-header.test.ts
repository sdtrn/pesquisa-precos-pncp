import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  assinarTokenSessao,
  COOKIE_NAME,
  type PayloadSessao,
} from "@/lib/server/session-edge";

describe("Task 9: Middleware de Proteção Global, Header Institucional e RBAC", () => {
  const middlewarePath = path.resolve(process.cwd(), "src/middleware.ts");
  const headerPath = path.resolve(process.cwd(), "src/components/HeaderInstitucional.tsx");
  const homePath = path.resolve(process.cwd(), "src/app/page.tsx");

  let tokenAdmin: string;
  let tokenConsulta: string;

  before(async () => {
    tokenAdmin = await assinarTokenSessao({
      uid: 1,
      nome: "Sérgio Dantas",
      email: "sergiodantastorres@gmail.com",
      perfil: "admin",
    });

    tokenConsulta = await assinarTokenSessao({
      uid: 2,
      nome: "Leitor Órgão",
      email: "leitor@pncp.gov.br",
      perfil: "consulta",
    });
  });

  test("arquivos do middleware, header e home page devem existir", () => {
    assert.ok(fs.existsSync(middlewarePath), "src/middleware.ts deve existir");
    assert.ok(fs.existsSync(headerPath), "src/components/HeaderInstitucional.tsx deve existir");
    assert.ok(fs.existsSync(homePath), "src/app/page.tsx deve existir");
  });

  describe("1. Pure Decision Helper: avaliarRotaMiddleware", () => {
    test("rotas de assets estáticos devem ser sempre permitidas (allow)", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");

      assert.deepEqual(await avaliarRotaMiddleware("/favicon.ico", ""), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/favicon.svg", ""), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/icon.svg", ""), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/_next/static/chunk.js", ""), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/_next/image", "?url=test"), { acao: "allow" });
    });

    test("rotas públicas de auth API (/api/auth/*) devem ser sempre permitidas (allow)", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");

      assert.deepEqual(await avaliarRotaMiddleware("/api/auth/login", ""), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/api/auth/cadastro", ""), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/api/auth/me", ""), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/api/auth/logout", ""), { acao: "allow" });
    });

    test("páginas públicas de auth (/login e /cadastro) para anônimo devem ser permitidas (allow)", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");

      assert.deepEqual(await avaliarRotaMiddleware("/login", "", null), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/cadastro", "", null), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/login", "", "invalido=123"), { acao: "allow" });
    });

    test("páginas públicas de auth (/login e /cadastro) para usuário autenticado devem redirecionar para /", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");

      const cookieAdmin = `${COOKIE_NAME}=${tokenAdmin}`;
      const cookieConsulta = `${COOKIE_NAME}=${tokenConsulta}`;

      assert.deepEqual(await avaliarRotaMiddleware("/login", "", cookieAdmin), {
        acao: "redirect",
        destino: "/",
      });
      assert.deepEqual(await avaliarRotaMiddleware("/cadastro", "", cookieAdmin), {
        acao: "redirect",
        destino: "/",
      });
      assert.deepEqual(await avaliarRotaMiddleware("/login", "", cookieConsulta), {
        acao: "redirect",
        destino: "/",
      });
    });

    test("rotas protegidas de API sem sessão devem retornar JSON 401", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");

      const rotasApi = ["/api/pesquisar", "/api/usuarios", "/api/historico", "/api/parse-requisitos"];
      for (const rota of rotasApi) {
        const res = await avaliarRotaMiddleware(rota, "", null);
        assert.deepEqual(res, {
          acao: "json",
          status: 401,
          body: { error: "Sessão expirada ou não autenticada. Faça login para continuar." },
        });
      }
    });

    test("rotas administrativas de API com perfil consulta devem retornar JSON 403", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");
      const cookieConsulta = `${COOKIE_NAME}=${tokenConsulta}`;

      const resUsuarios = await avaliarRotaMiddleware("/api/usuarios", "", cookieConsulta);
      assert.deepEqual(resUsuarios, {
        acao: "json",
        status: 403,
        body: { error: "Acesso restrito ao Administrador do sistema." },
      });

      const resHistorico = await avaliarRotaMiddleware("/api/historico", "", cookieConsulta);
      assert.deepEqual(resHistorico, {
        acao: "json",
        status: 403,
        body: { error: "Acesso restrito ao Administrador do sistema." },
      });
    });

    test("rotas operacionais de API com perfil consulta devem ser permitidas (allow)", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");
      const cookieConsulta = `${COOKIE_NAME}=${tokenConsulta}`;

      const resPesquisar = await avaliarRotaMiddleware("/api/pesquisar", "", cookieConsulta);
      assert.deepEqual(resPesquisar, { acao: "allow" });
    });

    test("todas as rotas de API com perfil admin devem ser permitidas (allow)", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");
      const cookieAdmin = `${COOKIE_NAME}=${tokenAdmin}`;

      assert.deepEqual(await avaliarRotaMiddleware("/api/usuarios", "", cookieAdmin), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/api/historico", "", cookieAdmin), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/api/pesquisar", "", cookieAdmin), { acao: "allow" });
    });

    test("páginas protegidas sem sessão devem redirecionar para /login com parâmetro redirect quando apropriado", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");

      // Raiz '/' redireciona para /login sem redirect param
      assert.deepEqual(await avaliarRotaMiddleware("/", "", null), {
        acao: "redirect",
        destino: "/login",
      });

      // Outras páginas preservam pathname e search
      assert.deepEqual(await avaliarRotaMiddleware("/usuarios", "", null), {
        acao: "redirect",
        destino: "/login?redirect=%2Fusuarios",
      });

      assert.deepEqual(await avaliarRotaMiddleware("/historico", "?pagina=2&busca=teste", null), {
        acao: "redirect",
        destino: `/login?redirect=${encodeURIComponent("/historico?pagina=2&busca=teste")}`,
      });
    });

    test("perfil consulta tentando acessar páginas restritas (/usuarios, /historico) deve ser redirecionado para /", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");
      const cookieConsulta = `${COOKIE_NAME}=${tokenConsulta}`;

      assert.deepEqual(await avaliarRotaMiddleware("/usuarios", "", cookieConsulta), {
        acao: "redirect",
        destino: "/",
      });
      assert.deepEqual(await avaliarRotaMiddleware("/historico", "", cookieConsulta), {
        acao: "redirect",
        destino: "/",
      });

      // Acesso à página principal '/' deve ser permitido
      assert.deepEqual(await avaliarRotaMiddleware("/", "", cookieConsulta), {
        acao: "allow",
      });
    });

    test("perfil admin deve ter acesso livre a todas as páginas protegidas", async () => {
      const { avaliarRotaMiddleware } = await import("@/middleware");
      const cookieAdmin = `${COOKIE_NAME}=${tokenAdmin}`;

      assert.deepEqual(await avaliarRotaMiddleware("/", "", cookieAdmin), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/usuarios", "", cookieAdmin), { acao: "allow" });
      assert.deepEqual(await avaliarRotaMiddleware("/historico", "", cookieAdmin), { acao: "allow" });
    });
  });

  describe("2. Next.js Middleware Handler", () => {
    test("middleware deve manipular redirect, json e allow corretamente com Responses padrão", async () => {
      const { middleware, config } = await import("@/middleware");

      assert.ok(typeof middleware === "function", "middleware deve ser uma função exportada");
      assert.ok(Array.isArray(config?.matcher), "config.matcher deve ser um array exportado");

      // 1. Redirecionamento anônimo em /
      const reqAnonimo = new Request("https://pncp.vercel.app/", {
        headers: {},
      });
      const resRedirect = await middleware(reqAnonimo);
      assert.equal(resRedirect.status, 307);
      assert.equal(resRedirect.headers.get("location"), "https://pncp.vercel.app/login");

      // 2. Erro 401 JSON anônimo em /api/pesquisar
      const reqApiAnonima = new Request("https://pncp.vercel.app/api/pesquisar", {
        headers: {},
      });
      const res401 = await middleware(reqApiAnonima);
      assert.equal(res401.status, 401);
      const data401 = await res401.json();
      assert.equal(data401.error, "Sessão expirada ou não autenticada. Faça login para continuar.");

      // 3. Erro 403 JSON consulta em /api/usuarios
      const reqApiConsulta = new Request("https://pncp.vercel.app/api/usuarios", {
        headers: {
          cookie: `${COOKIE_NAME}=${tokenConsulta}`,
        },
      });
      const res403 = await middleware(reqApiConsulta);
      assert.equal(res403.status, 403);
      const data403 = await res403.json();
      assert.equal(data403.error, "Acesso restrito ao Administrador do sistema.");

      // 4. Sucesso allow em /api/auth/me
      const reqAuthMe = new Request("https://pncp.vercel.app/api/auth/me", {
        headers: {},
      });
      const resAllow = await middleware(reqAuthMe);
      assert.equal(resAllow.headers.get("x-middleware-next"), "1");
    });
  });

  describe("3. HeaderInstitucional & RBAC UI Contract", () => {
    test("HeaderInstitucional deve suportar usuarioLogado e onLogout na interface", () => {
      const content = fs.readFileSync(headerPath, "utf-8");
      assert.match(content, /usuarioLogado\?:/i, "HeaderInstitucionalProps deve incluir usuarioLogado");
      assert.match(content, /onLogout\?:/i, "HeaderInstitucionalProps deve incluir onLogout");
    });

    test("HeaderInstitucional deve condicionar links administrativos (/historico, /usuarios) e pesquisas salvas ao perfil admin", () => {
      const content = fs.readFileSync(headerPath, "utf-8");

      // Navegação administrativa e botão de pesquisas salvas condicionados ao perfil admin
      assert.match(
        content,
        /usuarioLogado(\.|\?\.)perfil\s*===\s*["']admin["']/,
        "deve verificar se perfil === 'admin' para exibir controles restritos"
      );
      assert.match(content, /href=["']\/historico["']/, "deve possuir link para /historico");
      assert.match(content, /href=["']\/usuarios["']/, "deve possuir link para /usuarios");
      assert.match(content, /onLogout/, "deve acionar onLogout ao clicar em Sair");
      assert.match(content, /LogOut/i, "deve importar e utilizar ícone LogOut");
    });

    test("src/app/page.tsx deve gerenciar usuarioLogado, verificar sessão e prover logout seguro", () => {
      const content = fs.readFileSync(homePath, "utf-8");
      assert.match(content, /usuarioLogado/i, "page.tsx deve manter estado do usuarioLogado");
      assert.match(content, /\/api\/auth\/me/, "page.tsx deve verificar sessão chamando /api/auth/me");
      assert.match(content, /\/api\/auth\/logout/, "page.tsx deve realizar logout em /api/auth/logout");
      assert.match(content, /handleLogout/i, "page.tsx deve implementar função handleLogout");
    });
  });
});
