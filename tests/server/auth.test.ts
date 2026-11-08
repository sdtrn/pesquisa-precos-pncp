import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  AuthError,
  extrairMetadadosRequisicao,
  obterUsuarioLogado,
  exigirAutenticado,
  exigirAdmin,
  construirHeaderSetCookieSessao,
  construirHeaderLimparCookieSessao,
} from "@/lib/server/auth";
import {
  COOKIE_NAME,
  DEFAULT_TTL_SECONDS,
  assinarTokenSessao,
} from "@/lib/server/session-edge";
import type { UsuarioPncp } from "@/lib/server/db";

describe("Task 4: Camada de Autenticação Server-Side (src/lib/server/auth.ts)", () => {
  const usuarioAdminAtivo: UsuarioPncp = {
    id: 1,
    email: "admin@pncp.gov.br",
    nome: "Administrador Master",
    perfil: "admin",
    ativo: true,
    ultimo_login: new Date().toISOString(),
    criado_em: new Date().toISOString(),
  };

  const usuarioConsultaAtivo: UsuarioPncp = {
    id: 2,
    email: "auditor@tribunal.gov.br",
    nome: "Auditor Convidado",
    perfil: "consulta",
    ativo: true,
    ultimo_login: new Date().toISOString(),
    criado_em: new Date().toISOString(),
  };

  const usuarioDesativado: UsuarioPncp = {
    id: 3,
    email: "exonerado@pncp.gov.br",
    nome: "Ex-Servidor",
    perfil: "consulta",
    ativo: false,
    ultimo_login: new Date().toISOString(),
    criado_em: new Date().toISOString(),
  };

  describe("AuthError", () => {
    test("deve instanciar com status default 401 e nome AuthError", () => {
      const err = new AuthError("Não autenticado");
      assert.ok(err instanceof Error);
      assert.ok(err instanceof AuthError);
      assert.equal(err.name, "AuthError");
      assert.equal(err.message, "Não autenticado");
      assert.equal(err.status, 401);
    });

    test("deve aceitar status 403 explicitamente", () => {
      const err = new AuthError("Acesso negado", 403);
      assert.equal(err.status, 403);
      assert.equal(err.message, "Acesso negado");
    });
  });

  describe("construirHeaderSetCookieSessao e construirHeaderLimparCookieSessao", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test("deve construir header Set-Cookie com HttpOnly, SameSite=Lax e Max-Age padrão", () => {
      process.env.NODE_ENV = "development";
      const header = construirHeaderSetCookieSessao("meu-token-123");
      assert.ok(header.startsWith(`${COOKIE_NAME}=meu-token-123;`));
      assert.ok(header.includes("Path=/"));
      assert.ok(header.includes("HttpOnly"));
      assert.ok(header.includes("SameSite=Lax"));
      assert.ok(header.includes(`Max-Age=${DEFAULT_TTL_SECONDS}`));
      assert.ok(!header.includes("Secure"), "Em desenvolvimento não deve ter Secure");
    });

    test("deve incluir '; Secure' apenas quando NODE_ENV for production", () => {
      process.env.NODE_ENV = "production";
      const header = construirHeaderSetCookieSessao("token-prod");
      assert.ok(header.includes("; Secure"), "Em produção deve ter Secure");
    });

    test("deve aceitar maxAgeSegundos customizado e codificar caracteres especiais no token", () => {
      process.env.NODE_ENV = "development";
      const header = construirHeaderSetCookieSessao("tok=en with+spaces", 3600);
      assert.ok(header.includes(`${COOKIE_NAME}=tok%3Den%20with%2Bspaces`));
      assert.ok(header.includes("Max-Age=3600"));
    });

    test("construirHeaderLimparCookieSessao deve zerar o cookie imediatamente", () => {
      const header = construirHeaderLimparCookieSessao();
      assert.equal(header, `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    });
  });

  describe("extrairMetadadosRequisicao", () => {
    const originalAppUrl = process.env.APP_URL;

    afterEach(() => {
      process.env.APP_URL = originalAppUrl;
    });

    test("deve extrair primeiro IP de x-forwarded-for com múltiplos IPs", () => {
      delete process.env.APP_URL;
      const req = new Request("http://localhost:3000/api/auditoria", {
        headers: {
          "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
          "user-agent": "Mozilla/5.0 TestBrowser",
        },
      });

      const meta = extrairMetadadosRequisicao(req);
      assert.equal(meta.ip, "203.0.113.195");
      assert.equal(meta.userAgent, "Mozilla/5.0 TestBrowser");
      assert.equal(meta.originUrl, "http://localhost:3000");
    });

    test("deve recorrer ao x-real-ip quando não houver x-forwarded-for", () => {
      delete process.env.APP_URL;
      const req = new Request("http://localhost:3000/api/auditoria", {
        headers: {
          "x-real-ip": "198.51.100.42",
        },
      });

      const meta = extrairMetadadosRequisicao(req);
      assert.equal(meta.ip, "198.51.100.42");
      assert.equal(meta.userAgent, "Desconhecido");
    });

    test("deve usar 127.0.0.1 de fallback quando nenhum IP for informado", () => {
      delete process.env.APP_URL;
      const req = new Request("http://localhost:3000/api/auditoria");
      const meta = extrairMetadadosRequisicao(req);
      assert.equal(meta.ip, "127.0.0.1");
    });

    test("deve truncar user-agent a 250 caracteres", () => {
      const longUa = "A".repeat(300);
      const req = new Request("http://localhost:3000/api/auditoria", {
        headers: {
          "user-agent": longUa,
        },
      });

      const meta = extrairMetadadosRequisicao(req);
      assert.equal(meta.userAgent.length, 250);
      assert.equal(meta.userAgent, "A".repeat(250));
    });

    test("deve priorizar APP_URL se definido no ambiente", () => {
      process.env.APP_URL = "https://painel.pncp.gov.br";
      const req = new Request("http://localhost:3000/api/auditoria", {
        headers: {
          origin: "https://outro-site.com",
        },
      });

      const meta = extrairMetadadosRequisicao(req);
      assert.equal(meta.originUrl, "https://painel.pncp.gov.br");
    });

    test("deve usar header origin caso APP_URL não esteja definido", () => {
      delete process.env.APP_URL;
      const req = new Request("http://localhost:3000/api/auditoria", {
        headers: {
          origin: "https://pncp.custom-domain.com",
        },
      });

      const meta = extrairMetadadosRequisicao(req);
      assert.equal(meta.originUrl, "https://pncp.custom-domain.com");
    });

    test("deve montar origin a partir de x-forwarded-proto e x-forwarded-host", () => {
      delete process.env.APP_URL;
      const req = new Request("http://internal-node:8080/api/auditoria", {
        headers: {
          "x-forwarded-proto": "https",
          "x-forwarded-host": "gateway.pncp.gov.br",
        },
      });

      const meta = extrairMetadadosRequisicao(req);
      assert.equal(meta.originUrl, "https://gateway.pncp.gov.br");
    });
  });

  describe("obterUsuarioLogado", () => {
    test("deve retornar null se requisição não possuir cookie", async () => {
      const req = new Request("http://localhost:3000/api/test");
      const user = await obterUsuarioLogado(req, {
        buscarPorId: async () => usuarioAdminAtivo,
      });
      assert.equal(user, null);
    });

    test("deve retornar null se cookie não contiver pncp_sessao", async () => {
      const req = new Request("http://localhost:3000/api/test", {
        headers: { cookie: "outro_cookie=abc; sessao=123" },
      });
      const user = await obterUsuarioLogado(req, {
        buscarPorId: async () => usuarioAdminAtivo,
      });
      assert.equal(user, null);
    });

    test("deve retornar null se o token for adulterado ou inválido", async () => {
      const req = new Request("http://localhost:3000/api/test", {
        headers: { cookie: `${COOKIE_NAME}=token.invalido.ou.adulterado` },
      });
      const user = await obterUsuarioLogado(req, {
        buscarPorId: async () => usuarioAdminAtivo,
      });
      assert.equal(user, null);
    });

    test("deve retornar o usuário com sucesso quando o token for válido e o usuário estiver ativo", async () => {
      const token = await assinarTokenSessao({
        uid: usuarioAdminAtivo.id,
        email: usuarioAdminAtivo.email,
        nome: usuarioAdminAtivo.nome,
        perfil: usuarioAdminAtivo.perfil,
      });

      const req = new Request("http://localhost:3000/api/test", {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      });

      const user = await obterUsuarioLogado(req, {
        buscarPorId: async (id) => {
          assert.equal(id, usuarioAdminAtivo.id);
          return usuarioAdminAtivo;
        },
      });

      assert.ok(user !== null);
      assert.equal(user?.id, 1);
      assert.equal(user?.email, "admin@pncp.gov.br");
      assert.equal(user?.perfil, "admin");
      assert.equal(user?.ativo, true);
    });

    test("SEGURANÇA CRÍTICA: deve retornar null se o usuário estiver desativado no banco mesmo com cookie válido", async () => {
      const token = await assinarTokenSessao({
        uid: usuarioDesativado.id,
        email: usuarioDesativado.email,
        nome: usuarioDesativado.nome,
        perfil: usuarioDesativado.perfil,
      });

      const req = new Request("http://localhost:3000/api/test", {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      });

      const user = await obterUsuarioLogado(req, {
        buscarPorId: async (id) => {
          assert.equal(id, usuarioDesativado.id);
          return usuarioDesativado; // ativo: false
        },
      });

      assert.equal(user, null, "Sessão de usuário inativo deve ser invalidada imediatamente");
    });

    test("deve retornar null se o usuário não existir mais no banco de dados", async () => {
      const token = await assinarTokenSessao({
        uid: 9999,
        email: "fantasma@pncp.gov.br",
        nome: "Usuário Fantasma",
        perfil: "consulta",
      });

      const req = new Request("http://localhost:3000/api/test", {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      });

      const user = await obterUsuarioLogado(req, {
        buscarPorId: async () => null,
      });

      assert.equal(user, null);
    });
  });

  describe("exigirAutenticado", () => {
    test("deve retornar o usuário quando autenticado e ativo", async () => {
      const token = await assinarTokenSessao({
        uid: usuarioConsultaAtivo.id,
        email: usuarioConsultaAtivo.email,
        nome: usuarioConsultaAtivo.nome,
        perfil: usuarioConsultaAtivo.perfil,
      });

      const req = new Request("http://localhost:3000/api/pesquisa", {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      });

      const user = await exigirAutenticado(req, {
        buscarPorId: async () => usuarioConsultaAtivo,
      });

      assert.equal(user.id, usuarioConsultaAtivo.id);
      assert.equal(user.perfil, "consulta");
    });

    test("deve lançar AuthError com status 401 quando não autenticado", async () => {
      const req = new Request("http://localhost:3000/api/pesquisa");

      await assert.rejects(
        async () => {
          await exigirAutenticado(req, {
            buscarPorId: async () => usuarioConsultaAtivo,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.equal((err as AuthError).status, 401);
          assert.equal((err as AuthError).message, "Sessão expirada ou não autenticada. Faça login para continuar.");
          return true;
        }
      );
    });

    test("deve lançar AuthError 401 se usuário for inativo", async () => {
      const token = await assinarTokenSessao({
        uid: usuarioDesativado.id,
        email: usuarioDesativado.email,
        nome: usuarioDesativado.nome,
        perfil: usuarioDesativado.perfil,
      });

      const req = new Request("http://localhost:3000/api/pesquisa", {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      });

      await assert.rejects(
        async () => {
          await exigirAutenticado(req, {
            buscarPorId: async () => usuarioDesativado,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.equal((err as AuthError).status, 401);
          return true;
        }
      );
    });
  });

  describe("exigirAdmin", () => {
    test("deve retornar o usuário se for admin ativo", async () => {
      const token = await assinarTokenSessao({
        uid: usuarioAdminAtivo.id,
        email: usuarioAdminAtivo.email,
        nome: usuarioAdminAtivo.nome,
        perfil: usuarioAdminAtivo.perfil,
      });

      const req = new Request("http://localhost:3000/api/admin/usuarios", {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      });

      const user = await exigirAdmin(req, {
        buscarPorId: async () => usuarioAdminAtivo,
      });

      assert.equal(user.id, usuarioAdminAtivo.id);
      assert.equal(user.perfil, "admin");
    });

    test("deve lançar AuthError 403 se usuário autenticado tiver perfil consulta", async () => {
      const token = await assinarTokenSessao({
        uid: usuarioConsultaAtivo.id,
        email: usuarioConsultaAtivo.email,
        nome: usuarioConsultaAtivo.nome,
        perfil: usuarioConsultaAtivo.perfil,
      });

      const req = new Request("http://localhost:3000/api/admin/usuarios", {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      });

      await assert.rejects(
        async () => {
          await exigirAdmin(req, {
            buscarPorId: async () => usuarioConsultaAtivo,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.equal((err as AuthError).status, 403);
          assert.equal((err as AuthError).message, "Acesso restrito ao Administrador do sistema.");
          return true;
        }
      );
    });

    test("deve lançar AuthError 401 se nem sequer estiver autenticado", async () => {
      const req = new Request("http://localhost:3000/api/admin/usuarios");

      await assert.rejects(
        async () => {
          await exigirAdmin(req, {
            buscarPorId: async () => usuarioAdminAtivo,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.equal((err as AuthError).status, 401);
          return true;
        }
      );
    });
  });
});
