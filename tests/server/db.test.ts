import { test, describe, after, before } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_PRINCIPAL_EMAIL,
  ADMIN_PRINCIPAL_SENHA_INICIAL,
  ADMIN_PRINCIPAL_NOME,
  hashSenha,
  verificarSenha,
  carregarEnvLocal,
  getPool,
  inicializarBancoPncp,
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  criarSolicitacaoUsuario,
  listarUsuariosPncp,
  alternarStatusUsuario,
  alterarPerfilUsuario,
  atualizarUltimoLogin,
  registrarAuditoriaPesquisa,
  registrarLogAcesso,
  listarHistoricoAuditoria,
  listarLogsAcesso,
} from "@/lib/server/db";

describe("Task 3: Banco de Dados Neon, Migrações, Seed Admin e Hashing", () => {
  before(() => {
    carregarEnvLocal();
  });

  after(async () => {
    try {
      const pool = getPool();
      await pool.end();
    } catch {
      // Ignora erro se pool já finalizado
    }
  });

  describe("Hashing de Senha com scrypt e salt único", () => {
    test("deve gerar hashes diferentes para a mesma senha devido ao salt aleatório", () => {
      const senha = "MinhaSenhaSuperSegura2026!";
      const hash1 = hashSenha(senha);
      const hash2 = hashSenha(senha);

      assert.ok(hash1.startsWith("scrypt$"), "formato deve iniciar com scrypt$");
      assert.ok(hash2.startsWith("scrypt$"), "formato deve iniciar com scrypt$");
      assert.notEqual(hash1, hash2, "salts distintos geram hashes distintos");
    });

    test("deve verificar senha correta com sucesso", () => {
      const senha = "OutraSenhaValida@123";
      const hash = hashSenha(senha);

      assert.equal(verificarSenha(senha, hash), true, "senha correta deve retornar true");
    });

    test("deve rejeitar senha incorreta", () => {
      const senha = "SenhaOriginal#2026";
      const hash = hashSenha(senha);

      assert.equal(verificarSenha("SenhaErrada#2026", hash), false, "senha errada deve retornar false");
    });

    test("deve rejeitar hashes malformados ou inválidos sem lançar exceção", () => {
      assert.equal(verificarSenha("qualquer", ""), false);
      assert.equal(verificarSenha("qualquer", "invalido"), false);
      assert.equal(verificarSenha("qualquer", "scrypt$incompleto"), false);
      assert.equal(verificarSenha("qualquer", "md5$salt$hash"), false);
      assert.equal(verificarSenha("qualquer", "scrypt$naohex$naohex"), false);
      assert.equal(verificarSenha("qualquer", null as unknown as string), false);
      assert.equal(verificarSenha("qualquer", undefined as unknown as string), false);
    });
  });

  describe("Inicialização, Migrações e Seed do Admin Principal", () => {
    test("constantes do admin principal devem ter os valores esperados", () => {
      assert.equal(ADMIN_PRINCIPAL_EMAIL, "sergiodantastorres@gmail.com");
      assert.equal(ADMIN_PRINCIPAL_SENHA_INICIAL, "Recife2026@");
      assert.equal(ADMIN_PRINCIPAL_NOME, "Sérgio Dantas Torres");
    });

    test("deve inicializar tabelas e garantir seed do admin principal", async () => {
      await inicializarBancoPncp();

      const admin = await buscarUsuarioPorEmail(ADMIN_PRINCIPAL_EMAIL);
      assert.ok(admin !== null, "admin principal deve existir no banco de dados");
      assert.equal(admin.email.toLowerCase(), ADMIN_PRINCIPAL_EMAIL.toLowerCase());
      assert.equal(admin.nome, ADMIN_PRINCIPAL_NOME);
      assert.equal(admin.perfil, "admin");
      assert.equal(admin.ativo, true);
      assert.ok(admin.senha_hash.startsWith("scrypt$"), "hash do admin deve ser scrypt");
      assert.equal(
        verificarSenha(ADMIN_PRINCIPAL_SENHA_INICIAL, admin.senha_hash),
        true,
        "senha inicial do admin deve ser verificável com sucesso"
      );
    });

    test("deve proteger o administrador principal contra desativação", async () => {
      const admin = await buscarUsuarioPorEmail(ADMIN_PRINCIPAL_EMAIL);
      assert.ok(admin !== null);

      await assert.rejects(
        async () => {
          await alternarStatusUsuario(admin.id);
        },
        /Não é permitido desativar ou alterar o administrador principal/i
      );
    });

    test("deve proteger o administrador principal contra rebaixamento de perfil", async () => {
      const admin = await buscarUsuarioPorEmail(ADMIN_PRINCIPAL_EMAIL);
      assert.ok(admin !== null);

      await assert.rejects(
        async () => {
          await alterarPerfilUsuario(admin.id, "consulta");
        },
        /Não é permitido desativar ou alterar o administrador principal/i
      );
    });
  });

  describe("Ciclo de Vida de Usuário (Cadastro, Ativação, Perfil e Último Login)", () => {
    const emailTeste = `usuario-teste-${Date.now()}@exemplo.com`;
    let usuarioCriadoId: number | null = null;

    after(async () => {
      if (usuarioCriadoId) {
        const pool = getPool();
        await pool.query("DELETE FROM pncp_usuarios WHERE id = $1", [usuarioCriadoId]);
      }
    });

    test("deve criar solicitação de novo usuário com status pendente (ativo=false, perfil=consulta)", async () => {
      const novo = await criarSolicitacaoUsuario({
        nome: "Usuário Teste Temporário",
        email: emailTeste,
        senhaPlana: "SenhaTeste@2026",
      });

      assert.ok(novo.id > 0);
      assert.equal(novo.email, emailTeste.toLowerCase());
      assert.equal(novo.nome, "Usuário Teste Temporário");
      assert.equal(novo.perfil, "consulta");
      assert.equal(novo.ativo, false);

      usuarioCriadoId = novo.id;

      // Buscar por ID e verificar
      const recuperado = await buscarUsuarioPorId(novo.id);
      assert.ok(recuperado !== null);
      assert.equal(recuperado.id, novo.id);
      assert.equal(recuperado.ativo, false);
    });

    test("deve alternar status do usuário para ativo (aprovação de acesso)", async () => {
      assert.ok(usuarioCriadoId !== null);

      const resultado = await alternarStatusUsuario(usuarioCriadoId);
      assert.equal(resultado.usuario.ativo, true);
      assert.equal(resultado.foiAprovadoAgora, true);

      // Alternar novamente deve desativar
      const resultadoDesativar = await alternarStatusUsuario(usuarioCriadoId);
      assert.equal(resultadoDesativar.usuario.ativo, false);
      assert.equal(resultadoDesativar.foiAprovadoAgora, false);

      // Ativar novamente para próximos testes
      await alternarStatusUsuario(usuarioCriadoId);
    });

    test("deve alterar perfil do usuário para admin e depois consulta", async () => {
      assert.ok(usuarioCriadoId !== null);

      const promovido = await alterarPerfilUsuario(usuarioCriadoId, "admin");
      assert.equal(promovido.perfil, "admin");

      const rebaixado = await alterarPerfilUsuario(usuarioCriadoId, "consulta");
      assert.equal(rebaixado.perfil, "consulta");
    });

    test("deve atualizar data e hora de último login", async () => {
      assert.ok(usuarioCriadoId !== null);

      await atualizarUltimoLogin(usuarioCriadoId);
      const atualizado = await buscarUsuarioPorId(usuarioCriadoId);
      assert.ok(atualizado !== null);
      assert.ok(atualizado.ultimo_login !== null, "ultimo_login deve ter sido preenchido");
    });

    test("deve listar todos os usuários cadastrados", async () => {
      const lista = await listarUsuariosPncp();
      assert.ok(Array.isArray(lista));
      assert.ok(lista.length >= 2, "deve conter no mínimo o admin e o usuário de teste");

      const contemAdmin = lista.some((u) => u.email.toLowerCase() === ADMIN_PRINCIPAL_EMAIL.toLowerCase());
      const contemTeste = lista.some((u) => u.id === usuarioCriadoId);

      assert.equal(contemAdmin, true);
      assert.equal(contemTeste, true);
    });
  });

  describe("Auditoria de Pesquisas e Registro de Log de Acessos", () => {
    let idAuditoriaInserida: number | null = null;
    let idLogAcessoInserido: number | null = null;

    after(async () => {
      const pool = getPool();
      if (idAuditoriaInserida) {
        await pool.query("DELETE FROM pncp_historico_auditoria WHERE id = $1", [idAuditoriaInserida]);
      }
      if (idLogAcessoInserido) {
        await pool.query("DELETE FROM pncp_acessos_log WHERE id = $1", [idLogAcessoInserido]);
      }
    });

    test("deve registrar auditoria de pesquisa com conversão numérica correta", async () => {
      const id = await registrarAuditoriaPesquisa({
        usuario_id: null,
        usuario_nome: "Auditoria Test Runner",
        usuario_email: "auditoria@teste.local",
        usuario_perfil: "admin",
        descricao_objeto: "Medicamento Dipirona 500mg - Teste Integrado",
        termos_busca: "dipirona 500mg",
        escopo_orgaos: "todos",
        regiao_ou_uf: "PE",
        apenas_municipios_bilionarios: false,
        status_ata: "vigente",
        tipo_data: "vigencia_fim",
        periodo_pesquisa: "ultimos_180_dias",
        criterio_classificacao: "menor_preco",
        modo_normalizacao: "desativado",
        total_atas_varridas: 35,
        total_encontrados: 12,
        total_selecionados: 5,
        total_descartados: 7,
        media_estimada: 1.4567,
        unidade_referencia: "COMPRIMIDO",
        duracao_segundos: 2.34,
        ip_origem: "127.0.0.1",
        user_agent: "Node-Test-Runner/1.0",
        status: "sucesso",
        erro_mensagem: null,
      });

      assert.ok(typeof id === "number" && id > 0, "deve retornar o id inserido");
      idAuditoriaInserida = id;

      const historico = await listarHistoricoAuditoria(10);
      assert.ok(Array.isArray(historico));
      const registro = historico.find((h) => h.id === id);
      assert.ok(registro !== undefined, "registro recém-inserido deve constar no histórico");
      assert.equal(registro.descricao_objeto, "Medicamento Dipirona 500mg - Teste Integrado");
      assert.equal(typeof registro.media_estimada, "number", "media_estimada deve ser número JavaScript");
      assert.equal(registro.media_estimada, 1.4567);
      assert.equal(typeof registro.duracao_segundos, "number", "duracao_segundos deve ser número");
      assert.equal(registro.duracao_segundos, 2.34);
      assert.equal(registro.total_atas_varridas, 35);
      assert.equal(registro.total_encontrados, 12);
      assert.equal(registro.total_selecionados, 5);
      assert.equal(registro.total_descartados, 7);
      assert.equal(registro.apenas_municipios_bilionarios, false);
    });

    test("deve registrar log de acesso e listar corretamente", async () => {
      const id = await registrarLogAcesso({
        usuario_id: null,
        email_informado: "tentativa@exemplo.com",
        usuario_nome: null,
        evento: "LOGIN_PENDENTE",
        ip_origem: "192.168.1.100",
        user_agent: "Mozilla/5.0 Test",
        detalhes: "Aguardando aprovação do administrador",
      });

      assert.ok(typeof id === "number" && id > 0, "deve retornar o id do log inserido");
      idLogAcessoInserido = id;

      const logs = await listarLogsAcesso(10);
      assert.ok(Array.isArray(logs));
      const log = logs.find((l) => l.id === id);
      assert.ok(log !== undefined, "log recém-inserido deve constar na listagem");
      assert.equal(log.email_informado, "tentativa@exemplo.com");
      assert.equal(log.evento, "LOGIN_PENDENTE");
      assert.equal(log.ip_origem, "192.168.1.100");
    });
  });
});
