import nodemailer from "nodemailer";
import { carregarEnvLocal, ADMIN_PRINCIPAL_EMAIL } from "@/lib/server/db";
import { agoraRecifeFormatado } from "@/lib/domain/tz-recife";

export const EMAIL_DISCLAIMER_INDEPENDENTE =
  "Iniciativa pessoal e independente desenvolvida por Sérgio Dantas Torres para apoio técnico à pesquisa de preços (Lei nº 14.133/2021). Sem vínculo institucional, representação ou chancela oficial de órgãos públicos.";

function escaparHtml(texto: string): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function obterAppUrl(appUrlInformada?: string): string {
  carregarEnvLocal();
  const raw =
    appUrlInformada ||
    process.env.APP_URL ||
    "https://pesquisa-precos-pncp.vercel.app";
  return raw.replace(/\/$/, "");
}

/**
 * Formata o e-mail de notificação de novo cadastro enviado ao Administrador.
 */
export function formatarEmailNovoCadastro(dados: {
  nome: string;
  email: string;
  dataHora: string;
  appUrl?: string;
}): { assunto: string; texto: string; html: string } {
  const baseUrl = obterAppUrl(dados.appUrl);
  const urlUsuarios = `${baseUrl}/usuarios`;
  const nomeEscapado = escaparHtml(dados.nome);
  const emailEscapado = escaparHtml(dados.email);
  const dataHoraEscapada = escaparHtml(dados.dataHora);

  const assunto = `[Pesquisa de Preços PNCP] Nova Solicitação de Acesso: ${dados.nome}`;

  const texto = [
    "SISTEMA DE PESQUISA DE PREÇOS PNCP — NOVA SOLICITAÇÃO DE ACESSO",
    "================================================================",
    "",
    "Um novo usuário solicitou acesso ao sistema e aguarda sua moderação:",
    "",
    `Nome do Solicitante: ${dados.nome}`,
    `E-mail Informado:    ${dados.email}`,
    `Data e Hora:         ${dados.dataHora}`,
    "Status Atual:        PENDENTE DE APROVAÇÃO",
    "",
    "AVISO DE SEGURANÇA:",
    "Por segurança da informação, a conta do solicitante permanece BLOQUEADA",
    "(ativo = false) e sem acesso a consultas ou APIs até que você aprove o acesso.",
    "",
    `Para avaliar e aprovar/rejeitar este usuário, acesse o Painel de Gestão:`,
    urlUsuarios,
    "",
    "----------------------------------------------------------------",
    EMAIL_DISCLAIMER_INDEPENDENTE,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escaparHtml(assunto)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(15, 36, 66, 0.08);">
          <!-- Cabeçalho Navy com Borda Brass Gold -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F2442 0%, #1B365D 100%); padding: 28px 32px; border-bottom: 3px solid #B59410;">
              <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37;">
                Painel Administrativo &bull; Gestão de Acessos
              </p>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #FFFFFF; line-height: 1.3;">
                Nova Solicitação de Acesso
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #94A3B8;">
                Pesquisa de Preços PNCP &bull; Lei nº 14.133/2021
              </p>
            </td>
          </tr>

          <!-- Corpo Principal -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Um novo solicitante efetuou cadastro no sistema e aguarda sua autorização prévia para poder realizar pesquisas de preços.
              </p>

              <!-- Cartão de Dados do Solicitante -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F1F5F9; border-radius: 8px; border: 1px solid #CBD5E1; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748B; display: block; margin-bottom: 2px;">Nome do Solicitante</span>
                    <strong style="font-size: 16px; color: #0F2442;">${nomeEscapado}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748B; display: block; margin-bottom: 2px;">E-mail Informado</span>
                    <strong style="font-size: 15px; color: #1E293B; font-family: monospace;">${emailEscapado}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748B; display: block; margin-bottom: 2px;">Data e Hora da Solicitação</span>
                    <span style="font-size: 14px; color: #334155;">${dataHoraEscapada}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748B; display: block; margin-bottom: 6px;">Status no Banco</span>
                    <span style="display: inline-block; background-color: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.5px;">
                      PENDENTE DE APROVAÇÃO
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Aviso de Segurança -->
              <div style="background-color: #EFF6FF; border-left: 4px solid #2563EB; padding: 14px 16px; border-radius: 4px; margin-bottom: 28px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #1E40AF;">
                  <strong>Segurança em Profundidade:</strong> O usuário permanece bloqueado (<code>ativo = false</code>) e não tem permissão para logar ou executar pesquisas até que seja formalmente aprovado na tela de Gestão de Usuários.
                </p>
              </div>

              <!-- Botão de Ação -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${urlUsuarios}" style="display: inline-block; background: linear-gradient(135deg, #0F2442 0%, #1B365D 100%); color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 8px; border: 1px solid #B59410; box-shadow: 0 2px 6px rgba(15, 36, 66, 0.2);">
                      Acessar Gestão de Usuários
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 12px;">
                    <span style="font-size: 12px; color: #64748B;">Ou acesse diretamente: <a href="${urlUsuarios}" style="color: #1B365D; word-break: break-all;">${urlUsuarios}</a></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé com Disclaimer Independente -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 24px 32px; border-top: 1px solid #E2E8F0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.5; color: #64748B;">
                ${EMAIL_DISCLAIMER_INDEPENDENTE}
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                Mensagem enviada automaticamente pelo módulo de auditoria do sistema.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { assunto, texto, html };
}

/**
 * Formata o e-mail de confirmação enviado ao usuário após o Administrador aprovar seu acesso.
 */
export function formatarEmailAprovacaoUsuario(dados: {
  nome: string;
  email: string;
  appUrl?: string;
}): { assunto: string; texto: string; html: string } {
  const baseUrl = obterAppUrl(dados.appUrl);
  const urlLogin = `${baseUrl}/login`;
  const nomeEscapado = escaparHtml(dados.nome);
  const emailEscapado = escaparHtml(dados.email);

  const assunto = "[Pesquisa de Preços PNCP] Acesso Aprovado pelo Administrador";

  const texto = [
    "SISTEMA DE PESQUISA DE PREÇOS PNCP — ACESSO APROVADO",
    "====================================================",
    "",
    `Olá, ${dados.nome}!`,
    "",
    "Seu cadastro no Sistema de Pesquisa de Preços em Atas do PNCP (Lei nº 14.133/2021)",
    "foi avaliado e APROVADO pelo Administrador do sistema.",
    "",
    "DADOS DA SUA CONTA:",
    `E-mail de Login: ${dados.email}`,
    "Perfil Atribuído: CONSULTA",
    "Status:           ATIVO",
    "",
    "Para acessar a plataforma e realizar suas pesquisas, faça login pelo link:",
    urlLogin,
    "",
    "AVISO IMPORTANTE DE ENTREGABILIDADE (SPAM):",
    "Para garantir o recebimento de futuras comunicações e avisos do sistema, verifique",
    "sua pasta de Spam ou Lixo Eletrônico. Caso este e-mail esteja lá, marque o remetente",
    "sergiodantastorres@gmail.com como 'Não é spam' ou adicione-o aos seus contatos.",
    "",
    "OBSERVAÇÃO DE SEGURANÇA:",
    "Utilize a chave/credencial de acesso cadastrada no momento da sua solicitação.",
    "Por motivos de segurança, informações confidenciais de acesso nunca são trafegadas por e-mail.",
    "",
    "----------------------------------------------------------------",
    EMAIL_DISCLAIMER_INDEPENDENTE,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escaparHtml(assunto)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(15, 36, 66, 0.08);">
          <!-- Cabeçalho Navy com Borda Brass Gold -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F2442 0%, #1B365D 100%); padding: 28px 32px; border-bottom: 3px solid #B59410;">
              <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37;">
                Pesquisa de Preços PNCP &bull; Lei nº 14.133/2021
              </p>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #FFFFFF; line-height: 1.3;">
                Acesso Liberado com Sucesso!
              </h1>
            </td>
          </tr>

          <!-- Banner Esmeralda de Confirmação -->
          <tr>
            <td style="background-color: #ECFDF5; border-bottom: 1px solid #A7F3D0; padding: 14px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="28" style="vertical-align: middle;">
                    <span style="display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 50%; background-color: #059669; color: #FFFFFF; font-size: 13px; font-weight: bold;">&check;</span>
                  </td>
                  <td style="vertical-align: middle;">
                    <strong style="color: #065F46; font-size: 14px;">Solicitação Aprovada pelo Administrador</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corpo Principal -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #1E293B;">
                Olá, <strong>${nomeEscapado}</strong>!
              </p>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Sua solicitação de acesso ao Sistema de Pesquisa de Preços em Atas de Registro de Preços do PNCP foi analisada e aprovada. Sua conta já se encontra ativa.
              </p>

              <!-- Cartão de Dados de Acesso -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748B; display: block; margin-bottom: 2px;">E-mail de Login</span>
                    <strong style="font-size: 15px; color: #0F2442; font-family: monospace;">${emailEscapado}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748B; display: block; margin-bottom: 2px;">Perfil Liberado</span>
                    <strong style="font-size: 14px; color: #1E293B;">CONSULTA</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748B; display: block; margin-bottom: 4px;">Status</span>
                    <span style="display: inline-block; background-color: #D1FAE5; color: #065F46; border: 1px solid #6EE7B7; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 9999px;">
                      ATIVO
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Botão de Acesso / Login -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${urlLogin}" style="display: inline-block; background: linear-gradient(135deg, #0F2442 0%, #1B365D 100%); color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; border: 1px solid #B59410; box-shadow: 0 2px 6px rgba(15, 36, 66, 0.2);">
                      Fazer Login no Sistema
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <span style="font-size: 12px; color: #64748B;">Ou copie o link: <a href="${urlLogin}" style="color: #1B365D; word-break: break-all;">${urlLogin}</a></span>
                  </td>
                </tr>
              </table>

              <!-- Orientação de Entregabilidade / Spam -->
              <div style="background-color: #FEF3C7; border-left: 4px solid #D97706; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #92400E;">
                  Aviso de Entregabilidade (Spam / Lixo Eletrônico)
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #78350F;">
                  Caso esta mensagem tenha chegado em sua pasta de <strong>Spam</strong> ou <strong>Lixo Eletrônico</strong>, marque o remetente <strong>sergiodantastorres@gmail.com</strong> como <em>&ldquo;Não é spam&rdquo;</em> para continuar recebendo avisos essenciais de acesso.
                </p>
              </div>

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748B;">
                * Utilize a chave/credencial de acesso definida durante o seu pedido de cadastro. Por motivos de segurança, dados confidenciais nunca são enviados por e-mail.
              </p>
            </td>
          </tr>

          <!-- Rodapé com Disclaimer Independente -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 24px 32px; border-top: 1px solid #E2E8F0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.5; color: #64748B;">
                ${EMAIL_DISCLAIMER_INDEPENDENTE}
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                Mensagem gerada automaticamente em resposta à aprovação cadastral.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { assunto, texto, html };
}

/**
 * Envia notificação por e-mail para o Administrador quando um novo usuário solicita cadastro.
 * Resiliente: captura qualquer falha de rede/SMTP e nunca interrompe a requisição da API.
 */
export async function enviarNotificacaoNovoCadastro(
  dados: {
    nome: string;
    email: string;
    dataHora?: string;
    appUrl?: string;
  },
  deps?: {
    sendMail?: (mailOptions: Record<string, unknown>) => Promise<unknown>;
    smtpUser?: string;
    smtpPass?: string;
    adminEmail?: string;
  }
): Promise<{ enviado: boolean; mensagem: string }> {
  try {
    carregarEnvLocal();

    const smtpUser =
      deps?.smtpUser !== undefined
        ? deps.smtpUser
        : process.env.SMTP_USER || "sergiodantastorres@gmail.com";
    const smtpPass =
      deps?.smtpPass !== undefined ? deps.smtpPass : process.env.SMTP_PASS;
    const adminEmail =
      deps?.adminEmail ||
      process.env.ADMIN_EMAIL ||
      ADMIN_PRINCIPAL_EMAIL;

    if (!smtpUser || !smtpPass) {
      return {
        enviado: false,
        mensagem:
          "SMTP não configurado (SMTP_USER ou SMTP_PASS ausente no ambiente).",
      };
    }

    const dataHoraFinal = dados.dataHora || agoraRecifeFormatado();
    const { assunto, texto, html } = formatarEmailNovoCadastro({
      ...dados,
      dataHora: dataHoraFinal,
    });

    const mailOptions = {
      from: `"Pesquisa de Preços PNCP" <${smtpUser}>`,
      to: adminEmail,
      subject: assunto,
      text: texto,
      html,
    };

    if (deps?.sendMail) {
      await deps.sendMail(mailOptions);
    } else {
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = Number(process.env.SMTP_PORT || 465);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail(mailOptions);
    }

    return {
      enviado: true,
      mensagem: "Notificação de novo cadastro enviada com sucesso.",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[email] Falha ao enviar notificação de novo cadastro:", msg);
    return {
      enviado: false,
      mensagem: `Falha no envio de e-mail: ${msg}`,
    };
  }
}

/**
 * Envia notificação por e-mail diretamente ao usuário comunicando que seu acesso foi aprovado.
 * Resiliente: captura qualquer falha de rede/SMTP e nunca interrompe a requisição da API.
 */
export async function enviarNotificacaoAprovacao(
  dados: {
    nome: string;
    email: string;
    appUrl?: string;
  },
  deps?: {
    sendMail?: (mailOptions: Record<string, unknown>) => Promise<unknown>;
    smtpUser?: string;
    smtpPass?: string;
  }
): Promise<{ enviado: boolean; mensagem: string }> {
  try {
    carregarEnvLocal();

    const smtpUser =
      deps?.smtpUser !== undefined
        ? deps.smtpUser
        : process.env.SMTP_USER || "sergiodantastorres@gmail.com";
    const smtpPass =
      deps?.smtpPass !== undefined ? deps.smtpPass : process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      return {
        enviado: false,
        mensagem:
          "SMTP não configurado (SMTP_USER ou SMTP_PASS ausente no ambiente).",
      };
    }

    const destinatario = dados.email.trim();
    if (!destinatario) {
      return {
        enviado: false,
        mensagem: "Destinatário não informado.",
      };
    }

    const { assunto, texto, html } = formatarEmailAprovacaoUsuario(dados);

    const mailOptions = {
      from: `"Pesquisa de Preços PNCP" <${smtpUser}>`,
      to: destinatario,
      subject: assunto,
      text: texto,
      html,
    };

    if (deps?.sendMail) {
      await deps.sendMail(mailOptions);
    } else {
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = Number(process.env.SMTP_PORT || 465);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail(mailOptions);
    }

    return {
      enviado: true,
      mensagem: "Notificação de aprovação enviada com sucesso.",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[email] Falha ao enviar notificação de aprovação:", msg);
    return {
      enviado: false,
      mensagem: `Falha no envio de e-mail: ${msg}`,
    };
  }
}
