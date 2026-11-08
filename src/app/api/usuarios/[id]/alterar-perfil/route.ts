import {
  alterarPerfilUsuario,
  buscarUsuarioPorId,
  registrarLogAcesso,
} from "@/lib/server/db";
import {
  exigirAdmin,
  AuthError,
  extrairMetadadosRequisicao,
} from "@/lib/server/auth";

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
        { error: "Não é permitido alterar o perfil da própria conta." },
        { status: 400 }
      );
    }

    let novoPerfil: "admin" | "consulta" | undefined;
    try {
      const body = (await req.json()) as Record<string, unknown>;
      if (typeof body?.novoPerfil === "string") {
        if (body.novoPerfil === "admin" || body.novoPerfil === "consulta") {
          novoPerfil = body.novoPerfil;
        } else {
          return Response.json(
            { error: "Perfil inválido. Use 'admin' ou 'consulta'." },
            { status: 400 }
          );
        }
      }
    } catch {
      // Body não fornecido, faremos alternância automática
    }

    if (!novoPerfil) {
      const usuarioAtual = await buscarUsuarioPorId(targetId);
      if (!usuarioAtual) {
        return Response.json(
          { error: "Usuário não encontrado." },
          { status: 400 }
        );
      }
      novoPerfil = usuarioAtual.perfil === "admin" ? "consulta" : "admin";
    }

    const usuario = await alterarPerfilUsuario(targetId, novoPerfil);

    await registrarLogAcesso({
      usuario_id: admin.id,
      email_informado: admin.email,
      usuario_nome: admin.nome,
      evento: "PERFIL_ALTERADO",
      ip_origem: meta.ip,
      user_agent: meta.userAgent,
      detalhes: `Perfil do usuário #${usuario.id} (${usuario.email}) alterado para ${usuario.perfil}`,
    });

    return Response.json(
      {
        ok: true,
        usuario,
        message: `Perfil alterado para ${usuario.perfil} com sucesso.`,
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
