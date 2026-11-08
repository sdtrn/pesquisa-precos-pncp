import { alternarStatusUsuario, registrarLogAcesso } from "@/lib/server/db";
import {
  exigirAdmin,
  AuthError,
  extrairMetadadosRequisicao,
} from "@/lib/server/auth";
import { enviarNotificacaoAprovacao } from "@/lib/server/email";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const admin = await exigirAdmin(req);
    const meta = extrairMetadadosRequisicao(req);

    const { id } = await context.params;
    const targetId = Number(id);

    if (isNaN(targetId) || targetId <= 0) {
      return Response.json(
        { error: "Identificador de usuário inválido." },
        { status: 400 }
      );
    }

    if (targetId === admin.id) {
      return Response.json(
        { error: "Não é permitido alterar o status da própria conta." },
        { status: 400 }
      );
    }

    const { usuario, foiAprovadoAgora } = await alternarStatusUsuario(targetId);

    let emailEnviado = false;
    if (foiAprovadoAgora) {
      const skipEmail = req.headers.get("x-skip-email-test") === "1";
      if (!skipEmail) {
        const envio = await enviarNotificacaoAprovacao({
          nome: usuario.nome,
          email: usuario.email,
          appUrl: meta.originUrl,
        });
        emailEnviado = envio.enviado;
      }

      await registrarLogAcesso({
        usuario_id: admin.id,
        email_informado: admin.email,
        usuario_nome: admin.nome,
        evento: "USUARIO_APROVADO",
        ip_origem: meta.ip,
        user_agent: meta.userAgent,
        detalhes: `Acesso aprovado para o usuário #${usuario.id} (${usuario.email})`,
      });
    } else {
      await registrarLogAcesso({
        usuario_id: admin.id,
        email_informado: admin.email,
        usuario_nome: admin.nome,
        evento: "USUARIO_DESATIVADO",
        ip_origem: meta.ip,
        user_agent: meta.userAgent,
        detalhes: `Acesso desativado para o usuário #${usuario.id} (${usuario.email})`,
      });
    }

    return Response.json(
      {
        ok: true,
        usuario,
        foiAprovadoAgora,
        emailEnviado,
        message: foiAprovadoAgora
          ? "Usuário aprovado com sucesso!"
          : "Usuário desativado com sucesso.",
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 400 });
  }
}
