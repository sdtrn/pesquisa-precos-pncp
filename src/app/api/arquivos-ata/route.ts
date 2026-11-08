import { PNCPClient } from "@/lib/domain/pncp-client";
import type { ItemCandidato } from "@/lib/domain/types";
import { exigirAutenticado, AuthError } from "@/lib/server/auth";

export async function POST(req: Request): Promise<Response> {
  try {
    await exigirAutenticado(req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const itens = Array.isArray(body?.itens)
      ? (body.itens as ItemCandidato[])
      : [];

    if (itens.length === 0) {
      return Response.json({ itens: [] });
    }

    const client = new PNCPClient(true);
    await client.enriquecerItensComArquivosAta(itens);

    return Response.json({ itens });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: `Erro ao consultar arquivos da ata: ${String(err)}` },
      { status: 500 }
    );
  }
}
