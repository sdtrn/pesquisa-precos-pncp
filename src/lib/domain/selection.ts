import { TOP_N_ITENS_JANELA } from "@/data/constants";
import type { CriterioClassificacao, ItemCandidato, NivelAderencia } from "@/lib/domain/types";

/**
 * Retorna os `limite` (padrão: 20) melhores itens (menor preço ou maior desconto),
 * garantindo estritamente NO MÁXIMO UM ITEM POR ATA (Regra R6).
 * Quando o critério é 'maior_desconto', ordena de forma decrescente pela maior taxa.
 */
export function selecionarTop20Menores(
  itensCandidatos: ItemCandidato[],
  incluirRevisaoB = false,
  limite = TOP_N_ITENS_JANELA,
  criterioClassificacao?: CriterioClassificacao
): ItemCandidato[] {
  const permitidos = new Set<NivelAderencia>(
    incluirRevisaoB ? ["A", "B"] : ["A"]
  );
  const filtrados = itensCandidatos.filter((it) =>
    permitidos.has(it.aderencia)
  );

  const ehDesconto = criterioClassificacao === "maior_desconto";
  const melhorPorAta = new Map<string, ItemCandidato>();
  const ordenados = [...filtrados].sort((a, b) => {
    return ehDesconto
      ? b.valor_unitario - a.valor_unitario
      : a.valor_unitario - b.valor_unitario;
  });

  for (const it of ordenados) {
    const chaveAta = `${it.cnpj_orgao}|${it.numero_arp_licitacao}`;
    if (!melhorPorAta.has(chaveAta)) {
      melhorPorAta.set(chaveAta, it);
    }
  }

  return Array.from(melhorPorAta.values())
    .sort((a, b) =>
      ehDesconto
        ? b.valor_unitario - a.valor_unitario
        : a.valor_unitario - b.valor_unitario
    )
    .slice(0, limite);
}
