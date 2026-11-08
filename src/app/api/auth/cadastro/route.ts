import {
  buscarUsuarioPorEmail,
  criarSolicitacaoUsuario,
  registrarLogAcesso,
} from "@/lib/server/db";
import { extrairMetadadosRequisicao } from "@/lib/server/auth";
import { enviarNotificacaoNovoCadastro } from "@/lib/server/email";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export async function POST(req: Request): Promise<Response> {
  const meta = extrairMetadadosRequisicao(req);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "Payload JSON inválido." },
      { status: 400 }
    );
  }

  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  const confirmacao =
    typeof body.confirmacaoSenha === "string"
      ? body.confirmacaoSenha
      : typeof body.confirmacao_senha === "string"
        ? body.confirmacao_senha
        : undefined;

  if (!nome || nome.length < 2) {
    return Response.json(
      { error: "O nome completo deve conter pelo menos 2 caracteres." },
      { status: 400 }
    );
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return Response.json(
      { error: "Informe um endereço de e-mail válido." },
      { status: 400 }
    );
  }

  if (!senha || senha.length < 6) {
    return Response.json(
      { error: "A senha deve conter no mínimo 6 caracteres." },
      { status: 400 }
    );
  }

  if (confirmacao !== undefined && confirmacao !== senha) {
    return Response.json(
      { error: "A confirmação de senha não confere." },
      { status: 400 }
    );
  }

  const emailLimpo = email.toLowerCase();
  const existente = await buscarUsuarioPorEmail(emailLimpo);
  if (existente) {
    return Response.json(
      {
        error:
          "Este endereço de e-mail já possui cadastro ou solicitação registrada no sistema.",
      },
      { status: 409 }
    );
  }

  try {
    const novo = await criarSolicitacaoUsuario({
      nome,
      email: emailLimpo,
      senhaPlana: senha,
    });

    await registrarLogAcesso({
      usuario_id: novo.id,
      email_informado: novo.email,
      usuario_nome: novo.nome,
      evento: "CADASTRO_SOLICITADO",
      ip_origem: meta.ip,
      user_agent: meta.userAgent,
      detalhes: "Nova solicitação de acesso (status pendente)",
    });

    let emailNotificado = false;
    const skipEmail = req.headers.get("x-skip-email-test") === "1";
    if (!skipEmail) {
      const envio = await enviarNotificacaoNovoCadastro({
        nome: novo.nome,
        email: novo.email,
        appUrl: meta.originUrl,
      });
      emailNotificado = envio.enviado;
    }

    return Response.json(
      {
        ok: true,
        message:
          "Solicitação de acesso registrada com sucesso! O administrador foi notificado por e-mail e você receberá um aviso assim que seu acesso for liberado.",
        emailNotificado,
        usuario: {
          id: novo.id,
          email: novo.email,
          nome: novo.nome,
          perfil: novo.perfil,
          ativo: novo.ativo,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 400 });
  }
}
