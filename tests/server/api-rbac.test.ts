import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_PRINCIPAL_EMAIL,
  ADMIN_PRINCIPAL_SENHA_INICIAL,
  carregarEnvLocal,
  getPool,
  buscarUsuarioPorEmail,
} from "@/lib/server/db";
import { COOKIE_NAME } from "@/lib/server/session-edge";

// Import Route Handlers
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import { POST as cadastroHandler } from "@/app/api/auth/cadastro/route";
import { GET as meHandler } from "@/app/api/auth/me/route";
import { GET as usuariosHandler } from "@/app/api/usuarios/route";
import { POST as toggleStatusHandler } from "@/app/api/usuarios/[id]/toggle-status/route";
import { POST as alterarPerfilHandler } from "@/app/api/usuarios/[id]/alterar-perfil/route";
import { GET as historicoHandler } from "@/app/api/historico/route";
import { POST as parseRequisitosHandler } from "@/app/api/parse-requisitos/route";
import { POST as arquivosAtaHandler } from "@/app/api/arquivos-ata/route";
import { POST as pesquisarHandler } from "@/app/api/pesquisar/route";

describe("Task 6: Endpoints de API (Auth, Usuários, Histórico e Integração na Pesquisa)", () => {
  const testUserEmail = `teste.auditor.${Date.now()}@tribunal.test.br`;
  const testUserSenha = "SenhaForte2026@!";
  let testUserId: number;
  let adminCookieHeader: string;
  let userCookieHeader: string;
  let adminUserId: number;

  before(async () => {
    carregarEnvLocal();
  });

  after(async () => {
    try {
      const pool = getPool();
      if (testUserId) {
        await pool.query("DELETE FROM pncp_usuarios WHERE id = $1;", [testUserId]);
      }
      await pool.end();
    } catch {
      // Ignora erro se pool já finalizado
    }
  });

  describe("1. Cadastro de Usuário (POST /api/auth/cadastro)", () => {
    test("deve rejeitar cadastro com nome muito curto (< 2 caracteres)", async () => {
      const req = new Request("http://localhost:3000/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "A",
          email: "usuario@teste.com",
          senha: testUserSenha,
        }),
      });

      const res = await cadastroHandler(req);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /nome.*2/i);
    });

    test("deve rejeitar e-mail em formato inválido", async () => {
      const req = new Request("http://localhost:3000/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Auditor Teste",
          email: "email-invalido-sem-arroba",
          senha: testUserSenha,
        }),
      });

      const res = await cadastroHandler(req);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /e-mail válido/i);
    });

    test("deve rejeitar senha com menos de 6 caracteres", async () => {
      const req = new Request("http://localhost:3000/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Auditor Teste",
          email: "auditor@teste.com",
          senha: "123",
        }),
      });

      const res = await cadastroHandler(req);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /mínimo 6/i);
    });

    test("deve rejeitar confirmação de senha divergente quando informada", async () => {
      const req = new Request("http://localhost:3000/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Auditor Teste",
          email: "auditor@teste.com",
          senha: "SenhaValida123",
          confirmacaoSenha: "OutraSenha456",
        }),
      });

      const res = await cadastroHandler(req);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /confirmação de senha/i);
    });

    test("deve criar solicitação de cadastro com sucesso (status 201 e ativo = false)", async () => {
      const req = new Request("http://localhost:3000/api/auth/cadastro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-skip-email-test": "1",
        },
        body: JSON.stringify({
          nome: "Auditor Convidado da Silva",
          email: testUserEmail,
          senha: testUserSenha,
          confirmacaoSenha: testUserSenha,
        }),
      });

      const res = await cadastroHandler(req);
      assert.equal(res.status, 201);
      const data = await res.json();

      assert.equal(data.ok, true);
      assert.ok(data.usuario);
      assert.equal(data.usuario.email, testUserEmail.toLowerCase());
      assert.equal(data.usuario.perfil, "consulta");
      assert.equal(data.usuario.ativo, false);
      assert.ok(data.usuario.id > 0);
      testUserId = data.usuario.id;
    });

    test("deve rejeitar cadastro duplicado com status 409", async () => {
      const req = new Request("http://localhost:3000/api/auth/cadastro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-skip-email-test": "1",
        },
        body: JSON.stringify({
          nome: "Auditor Convidado Duplicado",
          email: testUserEmail,
          senha: testUserSenha,
        }),
      });

      const res = await cadastroHandler(req);
      assert.equal(res.status, 409);
      const data = await res.json();
      assert.match(data.error, /já possui cadastro/i);
    });
  });

  describe("2. Autenticação (POST /api/auth/login)", () => {
    test("deve rejeitar login com campos vazios (status 400)", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "", senha: "" }),
      });

      const res = await loginHandler(req);
      assert.equal(res.status, 400);
    });

    test("deve rejeitar credenciais incorretas com 401 e registrar LOGIN_FALHA", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testUserEmail, senha: "SenhaIncorreta" }),
      });

      const res = await loginHandler(req);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /incorretos/i);
    });

    test("deve retornar 403 com pendente=true para usuário inativo/não aprovado", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testUserEmail, senha: testUserSenha }),
      });

      const res = await loginHandler(req);
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.pendente, true);
      assert.match(data.error, /aguarda aprovação/i);
    });

    test("deve autenticar Admin Principal com sucesso, retornando cookie e perfil admin", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ADMIN_PRINCIPAL_EMAIL,
          senha: ADMIN_PRINCIPAL_SENHA_INICIAL,
        }),
      });

      const res = await loginHandler(req);
      assert.equal(res.status, 200);
      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie, "Cabeçalho Set-Cookie deve ser retornado");
      assert.ok(setCookie.includes(`${COOKIE_NAME}=`));

      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.usuario.email, ADMIN_PRINCIPAL_EMAIL.toLowerCase());
      assert.equal(data.usuario.perfil, "admin");
      assert.equal(data.usuario.ativo, true);

      adminUserId = data.usuario.id;
      // Extrair cookie para requisições autenticadas subsequentes
      const match = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      assert.ok(match);
      adminCookieHeader = `${COOKIE_NAME}=${match[1]}`;
    });
  });

  describe("3. Consulta de Sessão (GET /api/auth/me)", () => {
    test("deve retornar 401 autenticado=false quando sem cookie", async () => {
      const req = new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
      });

      const res = await meHandler(req);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.autenticado, false);
    });

    test("deve retornar 200 e dados do usuário com cookie de admin válido", async () => {
      const req = new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: { cookie: adminCookieHeader },
      });

      const res = await meHandler(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.autenticado, true);
      assert.equal(data.usuario.email, ADMIN_PRINCIPAL_EMAIL.toLowerCase());
      assert.equal(data.usuario.perfil, "admin");
    });
  });

  describe("4. Gestão de Usuários (GET /api/usuarios e moderação)", () => {
    test("deve listar usuários com sucesso quando chamado por Admin", async () => {
      const req = new Request("http://localhost:3000/api/usuarios", {
        method: "GET",
        headers: { cookie: adminCookieHeader },
      });

      const res = await usuariosHandler(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.usuarios));
      const cadastrado = data.usuarios.find((u: { id: number }) => u.id === testUserId);
      assert.ok(cadastrado, "Usuário recém-cadastrado deve constar na listagem");
      assert.equal(cadastrado.ativo, false);
    });

    test("deve impedir admin de alterar o status da própria conta (status 400)", async () => {
      const req = new Request(`http://localhost:3000/api/usuarios/${adminUserId}/toggle-status`, {
        method: "POST",
        headers: { cookie: adminCookieHeader },
      });

      const res = await toggleStatusHandler(req, {
        params: Promise.resolve({ id: String(adminUserId) }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /própria conta/i);
    });

    test("deve aprovar usuário pendente (toggle-status) com sucesso", async () => {
      const req = new Request(`http://localhost:3000/api/usuarios/${testUserId}/toggle-status`, {
        method: "POST",
        headers: {
          cookie: adminCookieHeader,
          "x-skip-email-test": "1",
        },
      });

      const res = await toggleStatusHandler(req, {
        params: Promise.resolve({ id: String(testUserId) }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.foiAprovadoAgora, true);
      assert.equal(data.usuario.ativo, true);
    });

    test("usuário recém-aprovado agora consegue efetuar login com sucesso", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testUserEmail, senha: testUserSenha }),
      });

      const res = await loginHandler(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.usuario.ativo, true);
      assert.equal(data.usuario.perfil, "consulta");

      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie);
      const match = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      assert.ok(match);
      userCookieHeader = `${COOKIE_NAME}=${match[1]}`;
    });
  });

  describe("5. RBAC: Bloqueio 403 para usuário 'consulta' em endpoints administrativos", () => {
    test("usuário 'consulta' deve receber 403 em GET /api/usuarios", async () => {
      const req = new Request("http://localhost:3000/api/usuarios", {
        method: "GET",
        headers: { cookie: userCookieHeader },
      });

      const res = await usuariosHandler(req);
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /restrito ao Administrador/i);
    });

    test("usuário 'consulta' deve receber 403 em POST /api/usuarios/[id]/toggle-status", async () => {
      const req = new Request(`http://localhost:3000/api/usuarios/${testUserId}/toggle-status`, {
        method: "POST",
        headers: { cookie: userCookieHeader },
      });

      const res = await toggleStatusHandler(req, {
        params: Promise.resolve({ id: String(testUserId) }),
      });
      assert.equal(res.status, 403);
    });

    test("usuário 'consulta' deve receber 403 em POST /api/usuarios/[id]/alterar-perfil", async () => {
      const req = new Request(`http://localhost:3000/api/usuarios/${testUserId}/alterar-perfil`, {
        method: "POST",
        headers: {
          cookie: userCookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ novoPerfil: "admin" }),
      });

      const res = await alterarPerfilHandler(req, {
        params: Promise.resolve({ id: String(testUserId) }),
      });
      assert.equal(res.status, 403);
    });

    test("usuário 'consulta' deve receber 403 em GET /api/historico", async () => {
      const req = new Request("http://localhost:3000/api/historico", {
        method: "GET",
        headers: { cookie: userCookieHeader },
      });

      const res = await historicoHandler(req);
      assert.equal(res.status, 403);
    });
  });

  describe("6. Alteração de Perfil de Acesso (POST /api/usuarios/[id]/alterar-perfil)", () => {
    test("Admin pode alterar perfil do usuário para 'admin'", async () => {
      const req = new Request(`http://localhost:3000/api/usuarios/${testUserId}/alterar-perfil`, {
        method: "POST",
        headers: {
          cookie: adminCookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ novoPerfil: "admin" }),
      });

      const res = await alterarPerfilHandler(req, {
        params: Promise.resolve({ id: String(testUserId) }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.usuario.perfil, "admin");
    });

    test("deve impedir alteração de perfil do admin principal (status 400)", async () => {
      const req = new Request(`http://localhost:3000/api/usuarios/${adminUserId}/alterar-perfil`, {
        method: "POST",
        headers: {
          cookie: adminCookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ novoPerfil: "consulta" }),
      });

      const res = await alterarPerfilHandler(req, {
        params: Promise.resolve({ id: String(adminUserId) }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /própria conta|administrador principal/i);
    });

    test("deve restaurar perfil para 'consulta' usando toggle automático sem body", async () => {
      const req = new Request(`http://localhost:3000/api/usuarios/${testUserId}/alterar-perfil`, {
        method: "POST",
        headers: { cookie: adminCookieHeader },
      });

      const res = await alterarPerfilHandler(req, {
        params: Promise.resolve({ id: String(testUserId) }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.usuario.perfil, "consulta");
    });
  });

  describe("7. Logout (POST /api/auth/logout)", () => {
    test("deve retornar 200 e Set-Cookie com Max-Age=0", async () => {
      const req = new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: { cookie: userCookieHeader },
      });

      const res = await logoutHandler(req);
      assert.equal(res.status, 200);
      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie);
      assert.ok(setCookie.includes("Max-Age=0"));
    });
  });

  describe("8. Painel de Auditoria e Histórico (GET /api/historico)", () => {
    test("Admin recebe lista de consultas, acessos e resumo consolidado", async () => {
      const req = new Request("http://localhost:3000/api/historico", {
        method: "GET",
        headers: { cookie: adminCookieHeader },
      });

      const res = await historicoHandler(req);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.ok(Array.isArray(data.consultas));
      assert.ok(Array.isArray(data.acessos));
      assert.ok(data.resumo);
      assert.equal(typeof data.resumo.totalConsultas, "number");
      assert.equal(typeof data.resumo.consultasSucesso, "number");
      assert.equal(typeof data.resumo.consultasErro, "number");
      assert.equal(typeof data.resumo.totalAcessos, "number");
      assert.equal(typeof data.resumo.usuariosUnicosConsultando, "number");

      // Deve conter os acessos registrados nesta bateria de testes
      assert.ok(data.acessos.length > 0);
      const achouCadastro = data.acessos.some(
        (a: { evento: string }) => a.evento === "CADASTRO_SOLICITADO"
      );
      assert.ok(achouCadastro, "Deve registrar evento CADASTRO_SOLICITADO no log");
    });
  });

  describe("9. Proteção de Endpoints de Domínio e Pesquisa", () => {
    test("POST /api/parse-requisitos deve retornar 401 sem autenticação", async () => {
      const req = new Request("http://localhost:3000/api/parse-requisitos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: "Notebook i7 16GB" }),
      });

      const res = await parseRequisitosHandler(req);
      assert.equal(res.status, 401);
    });

    test("POST /api/parse-requisitos deve processar com sucesso quando autenticado", async () => {
      const req = new Request("http://localhost:3000/api/parse-requisitos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: adminCookieHeader,
        },
        body: JSON.stringify({ descricao: "Notebook i7 16GB RAM 512GB SSD" }),
      });

      const res = await parseRequisitosHandler(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.termos));
      assert.ok(data.requisitos);
    });

    test("POST /api/arquivos-ata deve retornar 401 sem autenticação", async () => {
      const req = new Request("http://localhost:3000/api/arquivos-ata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens: [] }),
      });

      const res = await arquivosAtaHandler(req);
      assert.equal(res.status, 401);
    });

    test("POST /api/arquivos-ata deve processar com sucesso quando autenticado", async () => {
      const req = new Request("http://localhost:3000/api/arquivos-ata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: adminCookieHeader,
        },
        body: JSON.stringify({ itens: [] }),
      });

      const res = await arquivosAtaHandler(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data.itens, []);
    });

    test("POST /api/pesquisar deve retornar 401 sem autenticação", async () => {
      const req = new Request("http://localhost:3000/api/pesquisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termosBusca: ["cadeira de escritório"] }),
      });

      const res = await pesquisarHandler(req);
      assert.equal(res.status, 401);
    });

    test("POST /api/pesquisar deve validar payload e retornar 400 se termosBusca vazio", async () => {
      const req = new Request("http://localhost:3000/api/pesquisar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: adminCookieHeader,
        },
        body: JSON.stringify({ termosBusca: [] }),
      });

      const res = await pesquisarHandler(req);
      assert.equal(res.status, 400);
    });
  });
});
