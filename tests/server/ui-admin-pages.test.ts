import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 8: Painéis Administrativos (/usuarios e /historico)", () => {
  const usuariosPath = path.resolve(process.cwd(), "src/app/usuarios/page.tsx");
  const historicoPath = path.resolve(process.cwd(), "src/app/historico/page.tsx");

  test("arquivos de páginas administrativas devem existir", () => {
    assert.ok(fs.existsSync(usuariosPath), "src/app/usuarios/page.tsx deve existir");
    assert.ok(fs.existsSync(historicoPath), "src/app/historico/page.tsx deve existir");
  });

  describe("1. /usuarios (Painel de Gestão de Usuários e RBAC)", () => {
    test("deve possuir diretiva 'use client' e carregar dados do usuário atual e da listagem", () => {
      const content = fs.readFileSync(usuariosPath, "utf-8");
      assert.match(content, /"use client"|'use client'/, "deve ser Client Component");
      assert.match(content, /\/api\/auth\/me/, "deve verificar sessão em /api/auth/me");
      assert.match(content, /\/api\/usuarios/, "deve carregar usuários de /api/usuarios");
      assert.match(content, /\/toggle-status/, "deve chamar endpoint /toggle-status");
      assert.match(content, /\/alterar-perfil/, "deve chamar endpoint /alterar-perfil");
      assert.match(content, /\/api\/auth\/logout/, "deve permitir logout");
    });

    test("deve conter Header Institucional Navy & Brass com navegação e controle de tema", () => {
      const content = fs.readFileSync(usuariosPath, "utf-8");
      // Cores Navy e Brass
      assert.match(content, /#0F2442|#1B365D/, "deve conter cores Navy institucional");
      assert.match(content, /#D4AF37|#B59410/, "deve conter cores Brass/Dourado institucional");
      // Links de navegação
      assert.match(content, /href=["']\/["']/, "deve conter link para Pesquisa de Preços (/)");
      assert.match(content, /href=["']\/usuarios["']/, "deve conter link para Gestão de Usuários (/usuarios)");
      assert.match(content, /href=["']\/historico["']/, "deve conter link para Histórico de Auditoria (/historico)");
      // Dark Mode toggle
      assert.match(content, /pncp_theme/, "deve suportar alternância de tema no localStorage");
      assert.match(content, /aria-label=["']Alternar tema claro ou escuro["']/, "deve conter botão de tema acessível");
    });

    test("deve exibir cards de resumo KPI de usuários", () => {
      const content = fs.readFileSync(usuariosPath, "utf-8");
      assert.match(content, /Total de Usuários/i, "deve conter card Total de Usuários");
      assert.match(content, /Ativos/i, "deve conter card Usuários Ativos");
      assert.match(content, /Aguardando Aprovação/i, "deve conter card Aguardando Aprovação");
      assert.match(content, /Administradores/i, "deve conter card Administradores");
    });

    test("deve conter barra de busca e filtros de status", () => {
      const content = fs.readFileSync(usuariosPath, "utf-8");
      assert.match(content, /placeholder=["'].*(?:Buscar|Pesquisar).*["']/i, "deve ter campo de busca");
      assert.match(content, /Todos/i, "deve conter filtro Todos");
      assert.match(content, /Pendentes/i, "deve conter filtro Pendentes");
    });

    test("deve possuir banner de feedback acessível com role='alert'", () => {
      const content = fs.readFileSync(usuariosPath, "utf-8");
      assert.match(content, /role=["']alert["']/, "deve conter role='alert' para notificações");
      assert.match(content, /aria-live=["']polite["']/, "deve conter aria-live='polite'");
    });

    test("deve proteger sergiodantastorres@gmail.com e o próprio usuário contra desativação/rebaixamento", () => {
      const content = fs.readFileSync(usuariosPath, "utf-8");
      assert.match(content, /sergiodantastorres@gmail\.com/i, "deve referenciar o Admin Principal");
      assert.match(content, /Admin Principal/i, "deve conter badge de Admin Principal");
      assert.match(content, /Você/i, "deve conter identificação visual do usuário logado (Você)");
      // Trava visual de desativação/rebaixamento
      assert.match(
        content,
        /sergiodantastorres@gmail\.com|ADMIN_PRINCIPAL_EMAIL/i,
        "deve verificar o e-mail do admin principal na renderização de botões"
      );
    });

    test("deve exibir botões de ação 'Aprovar Acesso', 'Desativar', 'Tornar Admin' e 'Tornar Consulta'", () => {
      const content = fs.readFileSync(usuariosPath, "utf-8");
      assert.match(content, /Aprovar Acesso/i, "deve conter botão Aprovar Acesso");
      assert.match(content, /Desativar/i, "deve conter botão Desativar");
      assert.match(content, /Tornar Admin/i, "deve conter botão Tornar Admin");
      assert.match(content, /Tornar Consulta/i, "deve conter botão Tornar Consulta");
    });

    test("deve formatar datas no fuso horário America/Recife", () => {
      const content = fs.readFileSync(usuariosPath, "utf-8");
      assert.match(content, /America\/Recife/, "deve usar fuso horário America/Recife na formatação");
    });

    test("deve tratar perfil não-admin com barreira visual de acesso negado", () => {
      const content = fs.readFileSync(usuariosPath, "utf-8");
      assert.match(content, /Acesso Restrito|Acesso Negado|Não autorizado/i, "deve conter tratamento para não-admin");
    });
  });

  describe("2. /historico (Painel de Auditoria Geral e Dossiê Técnico)", () => {
    test("deve possuir diretiva 'use client' e consumir /api/historico e /api/auth/me", () => {
      const content = fs.readFileSync(historicoPath, "utf-8");
      assert.match(content, /"use client"|'use client'/, "deve ser Client Component");
      assert.match(content, /\/api\/auth\/me/, "deve verificar sessão em /api/auth/me");
      assert.match(content, /\/api\/historico/, "deve carregar dados de /api/historico");
      assert.match(content, /\/api\/auth\/logout/, "deve permitir logout");
    });

    test("deve conter Header Institucional com navegação completa", () => {
      const content = fs.readFileSync(historicoPath, "utf-8");
      assert.match(content, /#0F2442|#1B365D/, "deve conter cores Navy");
      assert.match(content, /#D4AF37|#B59410/, "deve conter cores Brass");
      assert.match(content, /href=["']\/["']/, "deve conter link para /");
      assert.match(content, /href=["']\/usuarios["']/, "deve conter link para /usuarios");
      assert.match(content, /href=["']\/historico["']/, "deve conter link para /historico");
      assert.match(content, /aria-label=["']Alternar tema claro ou escuro["']/, "deve conter botão de tema acessível");
    });

    test("deve exibir cards de resumo de auditoria (Total, Sucesso, Usuários Distintos, Acessos)", () => {
      const content = fs.readFileSync(historicoPath, "utf-8");
      assert.match(content, /Total de Consultas/i, "deve conter card Total de Consultas");
      assert.match(content, /Consultas com Sucesso|Sucesso/i, "deve conter card de Consultas com Sucesso");
      assert.match(content, /Usuários Distintos|Usuários Únicos/i, "deve conter card Usuários Distintos");
      assert.match(content, /Registros de Acesso|Logs de Acesso/i, "deve conter card Registros de Acesso");
    });

    test("deve conter duas abas de navegação (Consultas Realizadas e Acessos & Logins)", () => {
      const content = fs.readFileSync(historicoPath, "utf-8");
      assert.match(content, /Consultas Realizadas/i, "deve conter aba Consultas Realizadas");
      assert.match(content, /Acessos & Logins|Acessos e Logins/i, "deve conter aba Acessos & Logins");
    });

    test("na aba de consultas deve conter colunas de auditoria completas", () => {
      const content = fs.readFileSync(historicoPath, "utf-8");
      assert.match(content, /America\/Recife/, "deve usar fuso America/Recife");
      assert.match(content, /duracao_segundos|duração/i, "deve exibir duração");
      assert.match(content, /Solicitante/i, "deve conter coluna Solicitante");
      assert.match(content, /Objeto Consultado/i, "deve conter coluna Objeto Consultado");
      assert.match(content, /Escopo|Região|UF/i, "deve conter escopo/UF");
      assert.match(content, /Resultados|Encontrados/i, "deve conter resultados");
      assert.match(content, /Detalhes/i, "deve conter botão de Detalhes");
    });

    test("deve conter modal interativo 'Dossiê Técnico de Auditoria' com role='dialog' e fecho em Escape", () => {
      const content = fs.readFileSync(historicoPath, "utf-8");
      assert.match(content, /Dossiê Técnico de Auditoria/i, "deve conter título do Dossiê");
      assert.match(content, /role=["']dialog["']/, "modal deve ter role='dialog'");
      assert.match(content, /aria-modal=["']true["']/, "modal deve ter aria-modal='true'");
      assert.match(content, /Escape/, "deve suportar fechamento com tecla Escape");
      assert.match(content, /ip_origem|IP de Origem/i, "deve exibir IP no dossiê");
      assert.match(content, /user_agent|Navegador/i, "deve exibir User Agent no dossiê");
      assert.match(content, /unidade_referencia|Unidade de Referência/i, "deve exibir unidade de referência");
      assert.match(content, /modo_normalizacao|Normalização/i, "deve exibir modo de normalização");
      assert.match(content, /status_ata|Status da Ata/i, "deve exibir status da ata");
    });

    test("na aba de acessos deve conter filtro de eventos e colunas de segurança", () => {
      const content = fs.readFileSync(historicoPath, "utf-8");
      assert.match(content, /LOGIN_SUCESSO/, "deve listar eventos LOGIN_SUCESSO");
      assert.match(content, /LOGIN_FALHA/, "deve listar eventos LOGIN_FALHA");
      assert.match(content, /USUARIO_APROVADO/, "deve listar eventos USUARIO_APROVADO");
      assert.match(content, /LOGOUT/, "deve listar eventos LOGOUT");
      assert.match(content, /font-mono/, "deve usar fonte mono para IP");
    });

    test("deve tratar usuário não autenticado ou sem permissão de administrador", () => {
      const content = fs.readFileSync(historicoPath, "utf-8");
      assert.match(content, /Acesso Restrito|Acesso Negado|Não autorizado/i, "deve conter barreira de acesso restrito");
    });
  });

  describe("3. Governança e Neutralidade Institucional", () => {
    test("não deve conter ocorrências de @recife.pe.gov.br em nenhum dos painéis", () => {
      if (fs.existsSync(usuariosPath)) {
        const uContent = fs.readFileSync(usuariosPath, "utf-8");
        assert.doesNotMatch(uContent, /@recife\.pe\.gov\.br/i, "usuarios/page.tsx não deve conter @recife.pe.gov.br");
      }
      if (fs.existsSync(historicoPath)) {
        const hContent = fs.readFileSync(historicoPath, "utf-8");
        assert.doesNotMatch(hContent, /@recife\.pe\.gov\.br/i, "historico/page.tsx não deve conter @recife.pe.gov.br");
      }
    });
  });
});
