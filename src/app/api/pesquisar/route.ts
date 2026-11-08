import { executarPipelinePesquisa, selecionarTop20Menores } from "@/lib/domain/pipeline";
import { calcularEstatisticasPrecos } from "@/lib/domain/statistics";
import { TOP_N_ITENS_JANELA } from "@/data/constants";
import type { ParametrosPipeline } from "@/lib/domain/types";
import {
  extrairTokenDosCookies,
  verificarTokenSessao,
} from "@/lib/server/session-edge";
import { extrairMetadadosRequisicao } from "@/lib/server/auth";
import { registrarAuditoriaPesquisa } from "@/lib/server/db";

export const maxDuration = 300; // Fluid Compute Node.js 24 LTS default 300s

export async function POST(req: Request): Promise<Response> {
  // Validação instantânea em memória (0ms, sem roundtrip ao banco antes da pesquisa)
  const cookieHeader = req.headers.get("cookie");
  const token = extrairTokenDosCookies(cookieHeader);
  const sessao = token ? await verificarTokenSessao(token) : null;
  if (!sessao) {
    return Response.json(
      { error: "Sessão expirada ou não autenticada. Faça login para continuar." },
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

        // Envia o resultado imediatamente ao navegador (exatamente como antes)
        sendEvent({
          type: "result",
          data: resultado,
        });

        // Grava a auditoria de forma não-bloqueante em background
        const duracaoSegundos =
          Math.round((performance.now() - inicio) / 100) / 10;
        const crit =
          resultado.criterio_classificacao ||
          params.criterioClassificacao ||
          "menor_preco";
        const top20 = selecionarTop20Menores(
          resultado.itens_candidatos || [],
          false,
          TOP_N_ITENS_JANELA,
          crit
        );
        const stats = calcularEstatisticasPrecos(
          top20.map((i) => i.valor_unitario),
          crit
        );

        await registrarAuditoriaPesquisa({
          usuario_id: sessao.uid,
          usuario_nome: sessao.nome,
          usuario_email: sessao.email,
          usuario_perfil: sessao.perfil,
          descricao_objeto:
            params.descricaoObjeto?.trim() ||
            (params.termosBusca || []).join(", "),
          termos_busca: (params.termosBusca || []).join(", "),
          escopo_orgaos: params.escopoOrgaos ?? null,
          regiao_ou_uf: params.regiaoSelecionada ?? params.ufSelecionada ?? null,
          apenas_municipios_bilionarios:
            params.apenasMunicipiosBilionarios ?? null,
          status_ata: params.statusAta ?? null,
          tipo_data: params.tipoDataPeriodo ?? null,
          periodo_pesquisa:
            params.dataInicial && params.dataFinal
              ? `${params.dataInicial} até ${params.dataFinal}`
              : null,
          criterio_classificacao: crit,
          modo_normalizacao:
            resultado.modo_normalizacao_aplicado ??
            params.modoNormalizacao ??
            null,
          total_atas_varridas: resultado.total_atas_encontradas ?? 0,
          total_encontrados: resultado.total_itens_avaliados ?? 0,
          total_selecionados: (resultado.itens_candidatos || []).length,
          total_descartados: (resultado.descartados || []).length,
          media_estimada: stats.media ?? null,
          unidade_referencia: resultado.unidade_referencia_padrao ?? null,
          duracao_segundos: duracaoSegundos,
          ip_origem: meta.ip,
          user_agent: meta.userAgent,
          status: "sucesso",
          erro_mensagem: null,
        }).catch(() => {});
      } catch (err) {
        const erroMsg =
          err instanceof Error
            ? err.message
            : `Falha inesperada na consulta ao PNCP: ${String(err)}`;

        sendEvent({
          type: "error",
          error: erroMsg,
        });

        const duracaoSegundos =
          Math.round((performance.now() - inicio) / 100) / 10;
        await registrarAuditoriaPesquisa({
          usuario_id: sessao.uid,
          usuario_nome: sessao.nome,
          usuario_email: sessao.email,
          usuario_perfil: sessao.perfil,
          descricao_objeto:
            params.descricaoObjeto?.trim() ||
            (params.termosBusca || []).join(", "),
          termos_busca: (params.termosBusca || []).join(", "),
          escopo_orgaos: params.escopoOrgaos ?? null,
          regiao_ou_uf: params.regiaoSelecionada ?? params.ufSelecionada ?? null,
          apenas_municipios_bilionarios:
            params.apenasMunicipiosBilionarios ?? null,
          status_ata: params.statusAta ?? null,
          tipo_data: params.tipoDataPeriodo ?? null,
          periodo_pesquisa:
            params.dataInicial && params.dataFinal
              ? `${params.dataInicial} até ${params.dataFinal}`
              : null,
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
        }).catch(() => {});
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
