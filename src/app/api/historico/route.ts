import {
  listarHistoricoAuditoria,
  listarLogsAcesso,
} from "@/lib/server/db";
import { exigirAdmin, AuthError } from "@/lib/server/auth";

export async function GET(req: Request): Promise<Response> {
  try {
    await exigirAdmin(req);

    const consultas = await listarHistoricoAuditoria(200);
    const acessos = await listarLogsAcesso(200);

    const totalConsultas = consultas.length;
    const consultasSucesso = consultas.filter(
      (c) => c.status === "sucesso"
    ).length;
    const consultasErro = consultas.filter(
      (c) => c.status !== "sucesso"
    ).length;
    const totalAcessos = acessos.length;
    const emailsUnicos = new Set(
      consultas
        .map((c) => c.usuario_email)
        .filter((e): e is string => Boolean(e && e.trim()))
    );
    const usuariosUnicosConsultando = emailsUnicos.size;

    const resumo = {
      totalConsultas,
      consultasSucesso,
      consultasErro,
      totalAcessos,
      usuariosUnicosConsultando,
    };

    return Response.json(
      {
        consultas,
        acessos,
        resumo,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
