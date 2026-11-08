import { executarPipelinePesquisa, selecionarTop20Menores } from "@/lib/domain/pipeline";
import { calcularEstatisticasPrecos } from "@/lib/domain/statistics";
import type { ParametrosPipeline } from "@/lib/domain/types";
import {
  exigirAutenticado,
  AuthError,
  extrairMetadadosRequisicao,
} from "@/lib/server/auth";
import { registrarAuditoriaPesquisa } from "@/lib/server/db";

export const maxDuration = 300; // Fluid Compute Node.js 24 LTS default 300s

export async function POST(req: Request): Promise<Response> {
  let usuario;
  try {
    usuario = await exigirAutenticado(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: "Acesso não autorizado." },
      { status: 401 }
    );
  }

  const meta = extrairMetadadosRequisicao(req);

  let params: ParametrosPipeline;
  try {
    params = (await req.json()) as ParametrosPipeline;
  } catch {
    return Response.json(
      { error: "Payload JSON inválido." },
      { status: 400 }
    );
  }

  if (!Array.isArray(params.termosBusca) || params.termosBusca.length === 0) {
    return Response.json(
      { error: "Informe pelo menos um termo de busca." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const inicio = performance.now();

      const sendEvent = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // Stream closed by client
        }
      };

      try {
        sendEvent({
          type: "progress",
          msg: "Iniciando consulta aos servidores do PNCP...",
          frac: 0.01,
        });

        const resultado = await executarPipelinePesquisa(
          params,
          (msg, frac, parcial) => {
            sendEvent({
              type: "progress",
              msg,
              frac,
              parcial,
            });
          }
        );

        const duracaoSegundos =
          Math.round((performance.now() - inicio) / 100) / 10;
        const top20 = selecionarTop20Menores(
          resultado.itens_candidatos || [],
          false
        );
        const stats = calcularEstatisticasPrecos(
          top20.map((i) => i.valor_unitario)
        );

        await registrarAuditoriaPesquisa({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          usuario_email: usuario.email,
          usuario_perfil: usuario.perfil,
          descricao_objeto:
            params.descricaoObjeto?.trim() ||
            (params.termosBusca || []).join(", "),
          termos_busca: (params.termosBusca || []).join(", "),
          escopo_orgaos: params.escopoOrgaos ?? null,
          regiao_ou_uf: params.regiaoOuUf ?? null,
          apenas_municipios_bilionarios:
            params.apenasMunicipiosBilionarios ?? null,
          status_ata: params.statusAta ?? null,
          tipo_data: params.tipoData ?? null,
          periodo_pesquisa: params.periodoPesquisa ?? null,
          criterio_classificacao: params.criterioClassificacao ?? null,
          modo_normalizacao: params.modoNormalizacao ?? null,
          total_atas_varridas: resultado.total_atas_varridas ?? 0,
          total_encontrados: resultado.total_encontrados ?? 0,
          total_selecionados: resultado.total_selecionados ?? 0,
          total_descartados: resultado.total_descartados ?? 0,
          media_estimada: stats.media ?? null,
          unidade_referencia: resultado.unidade_medida_padrao ?? null,
          duracao_segundos: duracaoSegundos,
          ip_origem: meta.ip,
          user_agent: meta.userAgent,
          status: "sucesso",
          erro_mensagem: null,
        });

        sendEvent({
          type: "result",
          data: resultado,
        });
      } catch (err) {
        const duracaoSegundos =
          Math.round((performance.now() - inicio) / 100) / 10;
        const erroMsg =
          err instanceof Error
            ? err.message
            : `Falha inesperada na consulta ao PNCP: ${String(err)}`;

        await registrarAuditoriaPesquisa({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          usuario_email: usuario.email,
          usuario_perfil: usuario.perfil,
          descricao_objeto:
            params.descricaoObjeto?.trim() ||
            (params.termosBusca || []).join(", "),
          termos_busca: (params.termosBusca || []).join(", "),
          escopo_orgaos: params.escopoOrgaos ?? null,
          regiao_ou_uf: params.regiaoOuUf ?? null,
          apenas_municipios_bilionarios:
            params.apenasMunicipiosBilionarios ?? null,
          status_ata: params.statusAta ?? null,
          tipo_data: params.tipoData ?? null,
          periodo_pesquisa: params.periodoPesquisa ?? null,
          criterio_classificacao: params.criterioClassificacao ?? null,
          modo_normalizacao: params.modoNormalizacao ?? null,
          total_atas_varridas: 0,
          total_encontrados: 0,
          total_selecionados: 0,
          total_descartados: 0,
          media_estimada: null,
          unidade_referencia: null,
          duracao_segundos: duracaoSegundos,
          ip_origem: meta.ip,
          user_agent: meta.userAgent,
          status: "erro",
          erro_mensagem: erroMsg,
        });

        sendEvent({
          type: "error",
          error: erroMsg,
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Ignore
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
