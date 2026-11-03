import { TOP_N_ITENS_JANELA } from "@/data/constants";
import type { CriterioClassificacao, ItemCandidato, NivelAderencia } from "@/lib/domain/types";

/**
 * Retorna os `limite` (padrão: 20) melhores itens (menor preço normalizado ou maior desconto),
 * permitindo múltiplos itens homologados de uma mesma ARP com diferentes lotes/itens/fornecedores.
 * Deduplica apenas itens idênticos pelo conjunto (CNPJ, ARP, Número do Item/Lote).
 * Quando o critério é 'menor_preco', ordena de forma crescente pelo menor valor unitário normalizado.
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
  const ordenados = [...filtrados].sort((a, b) => {
    return ehDesconto
      ? b.valor_unitario - a.valor_unitario
      : a.valor_unitario - b.valor_unitario;
  });

  const vistos = new Set<string>();
  const unicos: ItemCandidato[] = [];

  for (const it of ordenados) {
    const chaveItem = `${it.cnpj_orgao}|${it.numero_arp_licitacao}|${it.numero_item_lote}`;
    if (!vistos.has(chaveItem)) {
      vistos.add(chaveItem);
      unicos.push(it);
    }
  }

  return unicos.slice(0, limite);
}
