import { PNCPClient } from "@/lib/domain/pncp-client";
import type { ItemCandidato } from "@/lib/domain/types";
import {
  extrairTokenDosCookies,
  verificarTokenSessao,
} from "@/lib/server/session-edge";

export async function POST(req: Request): Promise<Response> {
  try {
    const cookieHeader = req.headers.get("cookie");
    const token = extrairTokenDosCookies(cookieHeader);
    const sessao = token ? await verificarTokenSessao(token) : null;
    if (!sessao) {
      return Response.json(
        { error: "Sessão expirada ou não autenticada." },
        { status: 401 }
      );
    }

    const body = await req.json();
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
    return Response.json(
      { error: `Erro ao consultar arquivos da ata: ${String(err)}` },
      { status: 500 }
    );
  }
}
