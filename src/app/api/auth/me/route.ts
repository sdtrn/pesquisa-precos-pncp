import { exigirAutenticado, AuthError } from "@/lib/server/auth";

export async function GET(req: Request): Promise<Response> {
  try {
    const usuario = await exigirAutenticado(req);

    return Response.json(
      {
        autenticado: true,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          nome: usuario.nome,
          perfil: usuario.perfil,
          ativo: usuario.ativo,
          ultimo_login: usuario.ultimo_login,
          criado_em: usuario.criado_em,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const msg =
      err instanceof AuthError
        ? err.message
        : "Sessão expirada ou não autenticada.";
    return Response.json(
      { autenticado: false, error: msg },
      { status: 401 }
    );
  }
}
