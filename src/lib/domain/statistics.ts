import type { EstatisticasPrecos, ItemCandidato } from "@/lib/domain/types";

function calcularPercentil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return 0;
  if (ordenados.length === 1) return ordenados[0];
  const pos = (ordenados.length - 1) * p;
  const base = Math.floor(pos);
  const resto = pos - base;
  if (ordenados[base + 1] !== undefined) {
    return ordenados[base] + resto * (ordenados[base + 1] - ordenados[base]);
  }
  return ordenados[base];
}

/**
 * Calcula estatísticas completas de uma amostra de preços unitários (em R$):
 * média, mediana, menor, maior, desvio-padrão, coeficiente de variação (CV%),
 * quartis Q1/Q3, intervalo interquartil (IQR) e limites de detecção de outliers.
 */
export function calcularEstatisticasPrecos(valores: number[]): EstatisticasPrecos {
  const validos = valores.filter((v) => Number.isFinite(v) && v > 0);
  const n = validos.length;
  if (n === 0) {
    return {
      quantidade: 0,
      soma: 0,
      media: 0,
      mediana: 0,
      menor: 0,
      maior: 0,
      desvioPadrao: 0,
      coeficienteVariacao: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      limiteInferiorOutlier: 0,
      limiteSuperiorOutlier: 0,
    };
  }

  const ordenados = [...validos].sort((a, b) => a - b);
  const soma = ordenados.reduce((acc, v) => acc + v, 0);
  const media = soma / n;
  const mediana = calcularPercentil(ordenados, 0.5);
  const menor = ordenados[0];
  const maior = ordenados[n - 1];

  const variancia =
    n > 1
      ? ordenados.reduce((acc, v) => acc + Math.pow(v - media, 2), 0) / (n - 1)
      : 0;
  const desvioPadrao = Math.sqrt(variancia);
  const coeficienteVariacao = media > 0 ? (desvioPadrao / media) * 100 : 0;

  const q1 = calcularPercentil(ordenados, 0.25);
  const q3 = calcularPercentil(ordenados, 0.75);
  const iqr = Math.max(0, q3 - q1);

  const limiteInferiorOutlier = Math.max(0, q1 - 1.5 * iqr);
  const limiteSuperiorOutlier = q3 + 1.5 * iqr;

  return {
    quantidade: n,
    soma,
    media,
    mediana,
    menor,
    maior,
    desvioPadrao,
    coeficienteVariacao,
    q1,
    q3,
    iqr,
    limiteInferiorOutlier,
    limiteSuperiorOutlier,
  };
}

export function chaveItemUnica(item: Pick<ItemCandidato, "cnpj_orgao" | "numero_arp_licitacao" | "numero_item_lote">): string {
  return `${item.cnpj_orgao}|${item.numero_arp_licitacao}|${item.numero_item_lote}`;
}

/**
 * Identifica itens com preços inexequíveis ou excessivamente elevados (outliers)
 * combinando o critério de Tukey (IQR 1.5x) e desvio em relação à mediana (±60% quando IQR é muito estreito).
 */
export function identificarOutliersIqr(itens: ItemCandidato[]): Set<string> {
  const outliers = new Set<string>();
  if (itens.length < 4) {
    return outliers;
  }

  const stats = calcularEstatisticasPrecos(itens.map((i) => i.valor_unitario));
  const limInf = Math.min(stats.limiteInferiorOutlier, stats.mediana * 0.4);
  const limSup = Math.max(stats.limiteSuperiorOutlier, stats.mediana * 1.75);

  for (const it of itens) {
    if (it.valor_unitario < limInf || it.valor_unitario > limSup) {
      outliers.add(chaveItemUnica(it));
    }
  }
  return outliers;
}
