import { executarPipelinePesquisa } from "@/lib/domain/pipeline";
import type { ParametrosPipeline } from "@/lib/domain/types";

export const maxDuration = 300; // Fluid Compute Node.js 24 LTS default 300s

export async function POST(req: Request) {
  let params: ParametrosPipeline;
  try {
    params = (await req.json()) as ParametrosPipeline;
  } catch {
    return new Response(
      JSON.stringify({ error: "Payload JSON inválido." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!Array.isArray(params.termosBusca) || params.termosBusca.length === 0) {
    return new Response(
      JSON.stringify({ error: "Informe pelo menos um termo de busca." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
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

        sendEvent({
          type: "result",
          data: resultado,
        });
      } catch (err) {
        sendEvent({
          type: "error",
          error:
            err instanceof Error
              ? err.message
              : `Falha inesperada na consulta ao PNCP: ${String(err)}`,
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
