import {
  extrairRequisitosMinimos,
  gerarTermosBusca,
} from "@/lib/domain/parser-requisitos";
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
    return Response.json(
      { error: `Erro ao extrair requisitos: ${String(err)}` },
      { status: 500 }
    );
  }
}
