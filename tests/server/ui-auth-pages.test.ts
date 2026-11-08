import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 7: Telas Modernas de Login e Cadastro (Inspeção de UI e Acessibilidade)", () => {
  const shellPath = path.resolve(process.cwd(), "src/components/AuthSplitShell.tsx");
  const loginPath = path.resolve(process.cwd(), "src/app/login/page.tsx");
  const cadastroPath = path.resolve(process.cwd(), "src/app/cadastro/page.tsx");

  test("arquivos de UI devem existir no repositório", () => {
    assert.ok(fs.existsSync(shellPath), "AuthSplitShell.tsx deve existir em src/components/");
    assert.ok(fs.existsSync(loginPath), "page.tsx de login deve existir em src/app/login/");
    assert.ok(fs.existsSync(cadastroPath), "page.tsx de cadastro deve existir em src/app/cadastro/");
  });

  describe("1. AuthSplitShell.tsx (Layout Split-Screen Institucional e Acessível)", () => {
    test("deve possuir diretiva 'use client' e estrutura responsiva lg:grid lg:grid-cols-12", () => {
      const content = fs.readFileSync(shellPath, "utf-8");
      assert.match(content, /"use client"|'use client'/, "deve ser um Client Component");
      assert.match(content, /lg:grid/, "deve possuir grid responsivo para desktop");
      assert.match(content, /lg:grid-cols-12/, "deve possuir grid de 12 colunas em lg");
      assert.match(content, /min-h-screen/, "deve ocupar a altura mínima da tela");
    });

    test("deve conter Showcase Editorial à esquerda com os 3 pilares arquiteturais", () => {
      const content = fs.readFileSync(shellPath, "utf-8");
      // Pilares arquiteturais
      assert.match(content, /Auditoria Automática R1[–-]R7/i, "deve descrever o pilar de auditoria R1-R7");
      assert.match(content, /America\/Recife/, "deve mencionar o fuso horário America/Recife");
      assert.match(content, /Saneamento Estatístico/i, "deve descrever o saneamento estatístico");
      assert.match(content, /Intervalo Interquartil|IQR/i, "deve citar IQR / Interquartil");
      assert.match(content, /Exportação Tripla Auditável/i, "deve descrever a exportação tripla");
      assert.match(content, /\.xlsx/, "deve citar Excel com fórmulas");
    });

    test("deve exibir disclaimer obrigatório de iniciativa pessoal e independente de Sérgio Dantas Torres", () => {
      const content = fs.readFileSync(shellPath, "utf-8");
      assert.match(content, /Sérgio Dantas Torres/, "deve creditar expressamente Sérgio Dantas Torres");
      assert.match(
        content,
        /Iniciativa pessoal e independente idealizada e desenvolvida por Sérgio Dantas Torres/i,
        "deve conter a frase de iniciativa pessoal"
      );
      assert.match(
        content,
        /não possui vínculo institucional, representação, chancela ou patrocínio oficial/i,
        "deve esclarecer ausência de vínculo governamental oficial"
      );
    });

    test("deve conter botão de alternância Dark Mode acessível (min 44x44px)", () => {
      const content = fs.readFileSync(shellPath, "utf-8");
      assert.match(content, /aria-label=["']Alternar tema claro ou escuro["']/, "deve ter aria-label acessível");
      assert.match(content, /min-h-\[44px\]/, "deve ter altura mínima de 44px para toque acessível");
      assert.match(content, /min-w-\[44px\]/, "deve ter largura mínima de 44px para toque acessível");
      assert.match(content, /pncp_theme/, "deve sincronizar com localStorage pncp_theme");
    });
  });

  describe("2. /login (Página de Autenticação com Validações e Estados)", () => {
    test("deve conter use client e Suspense boundary para parâmetros de busca", () => {
      const content = fs.readFileSync(loginPath, "utf-8");
      assert.match(content, /"use client"|'use client'/, "deve ser Client Component");
      assert.match(content, /<Suspense/, "deve conter Suspense boundary para evitar erro de CSR bailout");
      assert.match(content, /useSearchParams\(/, "deve ler parâmetros de busca");
    });

    test("deve possuir container de erro acessível com role='alert' e aria-live='polite'", () => {
      const content = fs.readFileSync(loginPath, "utf-8");
      assert.match(content, /role=["']alert["']/, "deve ter container com role='alert'");
      assert.match(content, /aria-live=["']polite["']/, "deve ter aria-live='polite'");
      assert.match(content, /tabIndex=\{-1\}/, "deve permitir foco programático via tabIndex={-1}");
    });

    test("deve conter campos de formulário com auto-complete estrito e botão de ver/ocultar senha", () => {
      const content = fs.readFileSync(loginPath, "utf-8");
      assert.match(content, /autoComplete=["']email["']/, "campo de e-mail deve ter autoComplete='email'");
      assert.match(content, /autoComplete=["']current-password["']/, "campo de senha deve ter autoComplete='current-password'");
      assert.match(content, /aria-label=\{.*["'](?:Ocultar|Mostrar) senha["'].*\}/, "botão de alternar senha deve ter aria-label dinâmico");
    });

    test("deve conter aviso visual de conta pendente (403) informando contato por sergiodantastorres@gmail.com", () => {
      const content = fs.readFileSync(loginPath, "utf-8");
      assert.match(content, /Cadastro Aguardando Aprovação/i, "deve conter título para cadastro pendente");
      assert.match(content, /sergiodantastorres@gmail\.com/, "deve informar o e-mail de liberação");
    });

    test("deve conter link para a página /cadastro", () => {
      const content = fs.readFileSync(loginPath, "utf-8");
      assert.match(content, /href=["']\/cadastro["']/, "deve ter link para /cadastro");
      assert.match(content, /Solicitar acesso ao sistema/i, "deve ter CTA para solicitação de acesso");
    });

    test("deve higienizar o parâmetro redirect para prevenir ataques de Open Redirect", () => {
      const content = fs.readFileSync(loginPath, "utf-8");
      assert.match(
        content,
        /rawRedirect\.startsWith\(["']\/["']\)\s*&&\s*!rawRedirect\.startsWith\(["']\/\/["']\)/,
        "deve validar que redirectUrl inicia com '/' e não inicia com '//'"
      );
      assert.match(
        content,
        /!rawRedirect\.startsWith\(["']\/\\\\?["']\)/,
        "deve validar que redirectUrl não inicia com '/\\'"
      );

      // Simulação do predicado de segurança
      const isSafeRedirect = (raw: string) =>
        raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\");

      assert.equal(isSafeRedirect("/"), true);
      assert.equal(isSafeRedirect("/historico"), true);
      assert.equal(isSafeRedirect("/admin?tab=usuarios"), true);
      assert.equal(isSafeRedirect("https://evil.com"), false);
      assert.equal(isSafeRedirect("//evil.com"), false);
      assert.equal(isSafeRedirect("/\\evil.com"), false);
      assert.equal(isSafeRedirect("javascript:alert(1)"), false);
    });
  });

  describe("3. /cadastro (Página de Solicitação de Acesso Pré-Aprovado)", () => {
    test("deve conter use client, banner informativo de aprovação prévia e menção a sergiodantastorres@gmail.com", () => {
      const content = fs.readFileSync(cadastroPath, "utf-8");
      assert.match(content, /"use client"|'use client'/, "deve ser Client Component");
      assert.match(content, /Aguardando Aprovação/i, "deve informar sobre o status inicial pendente");
      assert.match(content, /sergiodantastorres@gmail\.com/, "deve informar que sergiodantastorres@gmail.com envia o e-mail");
    });

    test("deve conter container de erro acessível com role='alert' e aria-live='polite'", () => {
      const content = fs.readFileSync(cadastroPath, "utf-8");
      assert.match(content, /role=["']alert["']/, "deve ter container com role='alert'");
      assert.match(content, /aria-live=["']polite["']/, "deve ter aria-live='polite'");
    });

    test("deve conter campos de formulário com auto-complete estrito e confirmação de senha", () => {
      const content = fs.readFileSync(cadastroPath, "utf-8");
      assert.match(content, /autoComplete=["']name["']/, "campo de nome deve ter autoComplete='name'");
      assert.match(content, /autoComplete=["']email["']/, "campo de e-mail deve ter autoComplete='email'");
      assert.match(content, /autoComplete=["']new-password["']/, "campo de senha deve ter autoComplete='new-password'");
      assert.match(content, /confirmacaoSenha|confirmarSenha/i, "deve conter validação de confirmação de senha");
      assert.match(content, /As senhas informadas não coincidem/i, "deve validar paridade de senhas no cliente");
    });

    test("deve conter estado de sucesso pós-cadastro com link de retorno para /login", () => {
      const content = fs.readFileSync(cadastroPath, "utf-8");
      assert.match(content, /href=["']\/login["']/, "deve ter link de retorno para /login");
      assert.match(content, /CheckCircle2|CheckCircle/, "deve usar ícone de sucesso");
    });
  });

  describe("4. Integridade Institucional e Domínio", () => {
    test("não deve conter ocorrências de @recife.pe.gov.br nos componentes de autenticação", () => {
      const shell = fs.readFileSync(shellPath, "utf-8");
      const login = fs.readFileSync(loginPath, "utf-8");
      const cadastro = fs.readFileSync(cadastroPath, "utf-8");

      assert.doesNotMatch(shell, /@recife\.pe\.gov\.br/i, "AuthSplitShell não deve conter @recife.pe.gov.br");
      assert.doesNotMatch(login, /@recife\.pe\.gov\.br/i, "login/page.tsx não deve conter @recife.pe.gov.br");
      assert.doesNotMatch(cadastro, /@recife\.pe\.gov\.br/i, "cadastro/page.tsx não deve conter @recife.pe.gov.br");
    });
  });
});
