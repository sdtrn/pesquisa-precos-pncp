import {
  extrairRequisitosMinimos,
  gerarTermosBusca,
} from "@/lib/domain/parser-requisitos";
import { exigirAutenticado, AuthError } from "@/lib/server/auth";

export async function POST(req: Request): Promise<Response> {
  try {
    await exigirAutenticado(req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const descricao = String(body?.descricao || "").trim();

    if (!descricao) {
      return Response.json(
        { error: "A descrição do objeto não pode estar vazia." },
        { status: 400 }
      );
    }

    const termos = gerarTermosBusca(descricao);
    const requisitos = extrairRequisitosMinimos(descricao);

    return Response.json({
      termos,
      requisitos,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: `Erro ao extrair requisitos: ${String(err)}` },
      { status: 500 }
    );
  }
}
