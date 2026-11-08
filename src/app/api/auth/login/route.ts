import {
  buscarUsuarioPorEmail,
  verificarSenha,
  atualizarUltimoLogin,
  registrarLogAcesso,
} from "@/lib/server/db";
import { assinarTokenSessao } from "@/lib/server/session-edge";
import {
  extrairMetadadosRequisicao,
  construirHeaderSetCookieSessao,
} from "@/lib/server/auth";

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

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";

  if (!email || !senha) {
    return Response.json(
      { error: "Informe o e-mail e a senha de acesso." },
      { status: 400 }
    );
  }

  const emailLimpo = email.toLowerCase();
  const usuario = await buscarUsuarioPorEmail(emailLimpo);

  if (!usuario || !verificarSenha(senha, usuario.senha_hash)) {
    await registrarLogAcesso({
      usuario_id: usuario?.id ?? null,
      email_informado: emailLimpo,
      usuario_nome: usuario?.nome ?? null,
      evento: "LOGIN_FALHA",
      ip_origem: meta.ip,
      user_agent: meta.userAgent,
      detalhes: "Credenciais inválidas",
    });

    return Response.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 }
    );
  }

  if (!usuario.ativo) {
    await registrarLogAcesso({
      usuario_id: usuario.id,
      email_informado: usuario.email,
      usuario_nome: usuario.nome,
      evento: "LOGIN_PENDENTE",
      ip_origem: meta.ip,
      user_agent: meta.userAgent,
      detalhes: "Tentativa de login com cadastro aguardando aprovação",
    });

    return Response.json(
      {
        error:
          "Sua solicitação de cadastro foi realizada e aguarda aprovação do Administrador.",
        pendente: true,
      },
      { status: 403 }
    );
  }

  // Login com sucesso
  await atualizarUltimoLogin(usuario.id);
  await registrarLogAcesso({
    usuario_id: usuario.id,
    email_informado: usuario.email,
    usuario_nome: usuario.nome,
    evento: "LOGIN_SUCESSO",
    ip_origem: meta.ip,
    user_agent: meta.userAgent,
    detalhes: `Login efetuado (${usuario.perfil})`,
  });

  const token = await assinarTokenSessao({
    uid: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    perfil: usuario.perfil,
  });

  return Response.json(
    {
      ok: true,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
        ativo: usuario.ativo,
      },
    },
    {
      status: 200,
      headers: {
        "Set-Cookie": construirHeaderSetCookieSessao(token),
      },
    }
  );
}
