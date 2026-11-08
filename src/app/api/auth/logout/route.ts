import { registrarLogAcesso } from "@/lib/server/db";
import {
  extrairMetadadosRequisicao,
  obterUsuarioLogado,
  construirHeaderLimparCookieSessao,
} from "@/lib/server/auth";

export async function POST(req: Request): Promise<Response> {
  const meta = extrairMetadadosRequisicao(req);
  const usuario = await obterUsuarioLogado(req);

  if (usuario) {
    await registrarLogAcesso({
      usuario_id: usuario.id,
      email_informado: usuario.email,
      usuario_nome: usuario.nome,
      evento: "LOGOUT",
      ip_origem: meta.ip,
      user_agent: meta.userAgent,
      detalhes: "Logout efetuado",
    });
  }

  return Response.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": construirHeaderLimparCookieSessao(),
      },
    }
  );
}
