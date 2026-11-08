import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EMAIL_DISCLAIMER_INDEPENDENTE,
  formatarEmailNovoCadastro,
  formatarEmailAprovacaoUsuario,
  enviarNotificacaoNovoCadastro,
  enviarNotificacaoAprovacao,
} from "@/lib/server/email";

describe("Task 5: Serviço de Notificações por E-mail (email.ts)", () => {
  describe("Constante de Disclaimer Independente", () => {
    it("deve conter o texto de iniciativa pessoal independente de Sérgio Dantas Torres", () => {
      assert.ok(typeof EMAIL_DISCLAIMER_INDEPENDENTE === "string");
      assert.ok(EMAIL_DISCLAIMER_INDEPENDENTE.includes("Sérgio Dantas Torres"));
      assert.ok(EMAIL_DISCLAIMER_INDEPENDENTE.includes("Lei nº 14.133/2021"));
      assert.ok(EMAIL_DISCLAIMER_INDEPENDENTE.includes("Sem vínculo institucional"));
    });

    it("não deve conter qualquer menção a domínios institucionais proibidos", () => {
      assert.ok(!EMAIL_DISCLAIMER_INDEPENDENTE.includes("@recife.pe.gov" + ".br"));
    });
  });

  describe("Formatação de E-mail de Novo Cadastro (formatarEmailNovoCadastro)", () => {
    const dadosExemplo = {
      nome: "Carlos Eduardo da Silva",
      email: "carlos.silva@exemplo.com",
      dataHora: "08/11/2026 14:30:00",
      appUrl: "https://pesquisa-precos-pncp.vercel.app",
    };

    it("deve gerar assunto com identificação do sistema e nome do solicitante", () => {
      const email = formatarEmailNovoCadastro(dadosExemplo);
      assert.equal(
        email.assunto,
        "[Pesquisa de Preços PNCP] Nova Solicitação de Acesso: Carlos Eduardo da Silva"
      );
    });

    it("deve conter nome, e-mail, data/hora, status pendente e link para /usuarios no HTML e no texto", () => {
      const email = formatarEmailNovoCadastro(dadosExemplo);

      // Texto plano
      assert.ok(email.texto.includes("Carlos Eduardo da Silva"));
      assert.ok(email.texto.includes("carlos.silva@exemplo.com"));
      assert.ok(email.texto.includes("08/11/2026 14:30:00"));
      assert.ok(email.texto.includes("PENDENTE DE APROVAÇÃO"));
      assert.ok(email.texto.includes("https://pesquisa-precos-pncp.vercel.app/usuarios"));
      assert.ok(email.texto.includes(EMAIL_DISCLAIMER_INDEPENDENTE));

      // HTML
      assert.ok(email.html.includes("Carlos Eduardo da Silva"));
      assert.ok(email.html.includes("carlos.silva@exemplo.com"));
      assert.ok(email.html.includes("08/11/2026 14:30:00"));
      assert.ok(email.html.includes("PENDENTE DE APROVAÇÃO"));
      assert.ok(email.html.includes("href=\"https://pesquisa-precos-pncp.vercel.app/usuarios\""));
      assert.ok(email.html.includes(EMAIL_DISCLAIMER_INDEPENDENTE));
    });

    it("deve conter paleta visual Navy e Brass Gold no template HTML", () => {
      const email = formatarEmailNovoCadastro(dadosExemplo);
      const htmlUpper = email.html.toUpperCase();
      assert.ok(htmlUpper.includes("#0F2442") || htmlUpper.includes("#1B365D"));
      assert.ok(htmlUpper.includes("#B59410") || htmlUpper.includes("#D4AF37"));
    });

    it("deve sanitizar caracteres HTML para prevenir injeção em clientes de e-mail", () => {
      const dadosMaliciosos = {
        nome: "Hacker <script>alert('xss')</script> & Cia",
        email: "hacker\"@test.com",
        dataHora: "08/11/2026 14:35:00",
      };
      const email = formatarEmailNovoCadastro(dadosMaliciosos);
      assert.ok(!email.html.includes("<script>"));
      assert.ok(email.html.includes("&lt;script&gt;"));
      assert.ok(email.html.includes("&amp; Cia"));
    });

    it("não deve conter qualquer menção a domínios institucionais proibidos", () => {
      const email = formatarEmailNovoCadastro(dadosExemplo);
      assert.ok(!email.html.includes("@recife.pe.gov" + ".br"));
      assert.ok(!email.texto.includes("@recife.pe.gov" + ".br"));
    });
  });

  describe("Formatação de E-mail de Aprovação de Usuário (formatarEmailAprovacaoUsuario)", () => {
    const dadosAprovacao = {
      nome: "Mariana Souza Alencar",
      email: "mariana.alencar@empresa.com.br",
      appUrl: "https://pesquisa-precos-pncp.vercel.app",
    };

    it("deve gerar assunto oficial de aprovação de acesso", () => {
      const email = formatarEmailAprovacaoUsuario(dadosAprovacao);
      assert.equal(
        email.assunto,
        "[Pesquisa de Preços PNCP] Acesso Aprovado pelo Administrador"
      );
    });

    it("deve conter saudação, e-mail de login, perfil CONSULTA, status ATIVO e link para /login", () => {
      const email = formatarEmailAprovacaoUsuario(dadosAprovacao);

      // Texto plano
      assert.ok(email.texto.includes("Mariana Souza Alencar"));
      assert.ok(email.texto.includes("mariana.alencar@empresa.com.br"));
      assert.ok(email.texto.includes("CONSULTA"));
      assert.ok(email.texto.includes("ATIVO"));
      assert.ok(email.texto.includes("https://pesquisa-precos-pncp.vercel.app/login"));
      assert.ok(email.texto.includes("sergiodantastorres@gmail.com"));
      assert.ok(email.texto.includes(EMAIL_DISCLAIMER_INDEPENDENTE));

      // HTML
      assert.ok(email.html.includes("Mariana Souza Alencar"));
      assert.ok(email.html.includes("mariana.alencar@empresa.com.br"));
      assert.ok(email.html.includes("CONSULTA"));
      assert.ok(email.html.includes("ATIVO"));
      assert.ok(email.html.includes("href=\"https://pesquisa-precos-pncp.vercel.app/login\""));
      assert.ok(email.html.includes("sergiodantastorres@gmail.com"));
      assert.ok(email.html.includes(EMAIL_DISCLAIMER_INDEPENDENTE));
    });

    it("deve conter aviso de entregabilidade instruindo a verificar pasta de Spam", () => {
      const email = formatarEmailAprovacaoUsuario(dadosAprovacao);
      assert.ok(email.texto.toLowerCase().includes("spam") || email.texto.toLowerCase().includes("lixo eletrônico"));
      assert.ok(email.html.toLowerCase().includes("spam") || email.html.toLowerCase().includes("lixo eletrônico"));
      assert.ok(email.html.includes("sergiodantastorres@gmail.com"));
    });

    it("não deve conter senhas em texto puro nem anexos", () => {
      const email = formatarEmailAprovacaoUsuario(dadosAprovacao);
      assert.ok(!email.html.includes("senha"));
      assert.ok(!email.texto.includes("senha"));
    });

    it("não deve conter qualquer menção a domínios institucionais proibidos", () => {
      const email = formatarEmailAprovacaoUsuario(dadosAprovacao);
      assert.ok(!email.html.includes("@recife.pe.gov" + ".br"));
      assert.ok(!email.texto.includes("@recife.pe.gov" + ".br"));
    });
  });

  describe("Envio de E-mail de Novo Cadastro (enviarNotificacaoNovoCadastro)", () => {
    it("deve enviar notificação ao e-mail do administrador com dados corretos", async () => {
      let emailEnviado: Record<string, unknown> | null = null;
      const fakeSendMail = async (options: Record<string, unknown>) => {
        emailEnviado = options;
        return { messageId: "msg-12345" };
      };

      const resultado = await enviarNotificacaoNovoCadastro(
        {
          nome: "Juliana Mendes",
          email: "juliana@org.gov.br",
          dataHora: "08/11/2026 15:00:00",
        },
        {
          sendMail: fakeSendMail,
          smtpUser: "sergiodantastorres@gmail.com",
          smtpPass: "senha-app-fake",
          adminEmail: "sergiodantastorres@gmail.com",
        }
      );

      assert.equal(resultado.enviado, true);
      assert.ok(resultado.mensagem.includes("sucesso"));
      assert.ok(emailEnviado !== null);
      assert.equal(
        (emailEnviado as any).to,
        "sergiodantastorres@gmail.com"
      );
      assert.ok(
        String((emailEnviado as any).subject).includes("Juliana Mendes")
      );
      assert.ok(
        String((emailEnviado as any).html).includes("juliana@org.gov.br")
      );
    });

    it("deve retornar enviado=false sem estourar exceção quando credenciais SMTP estiverem ausentes", async () => {
      const resultado = await enviarNotificacaoNovoCadastro(
        {
          nome: "Teste Sem SMTP",
          email: "sem.smtp@teste.com",
        },
        {
          smtpUser: "",
          smtpPass: "",
        }
      );

      assert.equal(resultado.enviado, false);
      assert.ok(resultado.mensagem.includes("SMTP"));
    });

    it("deve capturar falhas de transporte SMTP e retornar enviado=false sem quebrar a execução", async () => {
      const fakeFailingSendMail = async () => {
        throw new Error("Falha de conexão SMTP: ECONNREFUSED 127.0.0.1:465");
      };

      const resultado = await enviarNotificacaoNovoCadastro(
        {
          nome: "Teste Erro Rede",
          email: "erro.rede@teste.com",
        },
        {
          sendMail: fakeFailingSendMail,
          smtpUser: "sergiodantastorres@gmail.com",
          smtpPass: "fake-pass",
        }
      );

      assert.equal(resultado.enviado, false);
      assert.ok(resultado.mensagem.includes("ECONNREFUSED"));
    });
  });

  describe("Envio de E-mail de Aprovação (enviarNotificacaoAprovacao)", () => {
    it("deve enviar notificação diretamente para o e-mail do usuário aprovado", async () => {
      let emailEnviado: Record<string, unknown> | null = null;
      const fakeSendMail = async (options: Record<string, unknown>) => {
        emailEnviado = options;
        return { messageId: "msg-67890" };
      };

      const resultado = await enviarNotificacaoAprovacao(
        {
          nome: "Roberto Firmino",
          email: "roberto.firmino@gmail.com",
        },
        {
          sendMail: fakeSendMail,
          smtpUser: "sergiodantastorres@gmail.com",
          smtpPass: "senha-app-fake",
        }
      );

      assert.equal(resultado.enviado, true);
      assert.ok(resultado.mensagem.includes("sucesso"));
      assert.ok(emailEnviado !== null);
      assert.equal((emailEnviado as any).to, "roberto.firmino@gmail.com");
      assert.ok(
        String((emailEnviado as any).subject).includes("Acesso Aprovado")
      );
      assert.ok(
        String((emailEnviado as any).html).includes("Roberto Firmino")
      );
    });

    it("deve retornar enviado=false amigavelmente quando SMTP estiver ausente", async () => {
      const resultado = await enviarNotificacaoAprovacao(
        {
          nome: "Sem SMTP",
          email: "sem.smtp@teste.com",
        },
        {
          smtpUser: "",
          smtpPass: "",
        }
      );

      assert.equal(resultado.enviado, false);
      assert.ok(resultado.mensagem.includes("SMTP"));
    });

    it("deve capturar falhas de envio e retornar status false sem estourar", async () => {
      const fakeFailingSendMail = async () => {
        throw new Error("Autenticação SMTP rejeitada (Invalid Credentials)");
      };

      const resultado = await enviarNotificacaoAprovacao(
        {
          nome: "Falha Auth",
          email: "falha.auth@teste.com",
        },
        {
          sendMail: fakeFailingSendMail,
          smtpUser: "sergiodantastorres@gmail.com",
          smtpPass: "pass-invalida",
        }
      );

      assert.equal(resultado.enviado, false);
      assert.ok(resultado.mensagem.includes("Invalid Credentials"));
    });
  });
});
