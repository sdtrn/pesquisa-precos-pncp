import {
  descreverArquivosEvidenciaItem,
  sanitizarCelulaExcel,
} from "@/lib/export/exporter-xlsx";
import type { CriterioClassificacao, ItemCandidato } from "@/lib/domain/types";
import { formatValorOuTaxa } from "@/lib/domain/statistics";
import {
  DECLARACAO_INDEPENDENCIA_TEXTO,
  TERMO_DE_USO_DISCLAIMER_TEXTO,
} from "@/data/constants";

export function formatarMoedaBr(valor: number): string {
  const num = Number.isFinite(valor) ? valor : 0;
  return `R$ ${num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escaparCampoCsv(val: string): string {
  let s = String(val ?? "");
  // Proteção contra CSV Injection (=, +, -, @)
  if (s.startsWith("=") || s.startsWith("+") || s.startsWith("@") || s.startsWith("-")) {
    if (s !== "-" && s !== "—" && !/^-?\d+(?:[.,]\d+)?$/.test(s)) {
      s = `'${s}`;
    }
  }
  if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const HEADERS_CSV = [
  "Descrição do objeto",
  "Valor Unitário (R$)",
  "Quantitativo previsto na ARP",
  "valor_unitario_normalizado",
  "formula_normalizacao",
  "valor_original_arp",
  "unidade_original_arp",
  "Nº do Item/Lote",
  "Nº da ARP / Licitação",
  "Possibilidade de Adesão",
  "Data de Assinatura",
  "Órgão Gerenciador/UF",
  "Fornecedor",
  "Link Direto da ARP no Portal PNCP",
  "Link Direto Download PDF da ARP Inicial",
  "Links Diretos dos Termos Aditivos da ARP",
];

/**
 * Gera o conteúdo `.csv` da Tabela Consolidada (codificação UTF-8 com BOM e separador `;`),
 * contendo as colunas auditáveis de normalização (valor_unitario_normalizado, formula_normalizacao,
 * valor_original_arp, unidade_original_arp), possibilidade de adesão, data de assinatura, média dos valores e links diretos.
 */
export function gerarCsvConsolidado(
  itensSelecionados: ItemCandidato[],
  criterioClassificacao: CriterioClassificacao = "menor_preco"
): string {
  const ehDesconto = criterioClassificacao === "maior_desconto";
  const linhas: string[] = [];
  const cabecalho = [
    "Descrição do objeto",
    ehDesconto ? "Taxa de Desconto (%)" : "Valor Unitário (R$)",
    "Quantitativo previsto na ARP",
    "valor_unitario_normalizado",
    "formula_normalizacao",
    "valor_original_arp",
    "unidade_original_arp",
    "Nº do Item/Lote",
    "Nº da ARP / Licitação",
    "Possibilidade de Adesão",
    "Data de Assinatura",
    "Órgão Gerenciador/UF",
    "Fornecedor",
    "Link Direto da ARP no Portal PNCP",
    "Link Direto Download PDF da ARP Inicial",
    "Links Diretos dos Termos Aditivos da ARP",
  ];
  linhas.push(cabecalho.map(escaparCampoCsv).join(";"));

  let soma = 0;
  for (const item of itensSelecionados) {
    const val = Number(item.valor_unitario || 0);
    soma += val;
    const valFmt = formatValorOuTaxa(val, criterioClassificacao).replace(/\u00A0/g, " ");
    const formulaNorm = sanitizarCelulaExcel(item.formula_normalizacao || "-");
    const valOriginalFmt =
      item.valor_original != null
        ? formatValorOuTaxa(Number(item.valor_original), criterioClassificacao).replace(/\u00A0/g, " ")
        : valFmt;
    const unidOriginal = sanitizarCelulaExcel(
      item.unidade_original || item.unidade_fornecimento || "-"
    );

    const ev = descreverArquivosEvidenciaItem(item);
    const linksAditivos =
      ev.termosAditivos.length > 0
        ? ev.termosAditivos.map((t) => `${t.rotulo}: ${t.url}`).join(" | ")
        : "Sem termos aditivos";

    const row = [
      sanitizarCelulaExcel(item.descricao_objeto),
      valFmt,
      sanitizarCelulaExcel(item.quantitativo_previsto_arp || "não informado"),
      valFmt,
      formulaNorm,
      valOriginalFmt,
      unidOriginal,
      sanitizarCelulaExcel(item.numero_item_lote || "-"),
      sanitizarCelulaExcel(item.numero_arp_licitacao),
      sanitizarCelulaExcel(item.possibilidade_adesao || "Não informado"),
      sanitizarCelulaExcel(item.data_assinatura || "não informado"),
      sanitizarCelulaExcel(item.orgao_gerenciador_uf),
      sanitizarCelulaExcel(item.fornecedor),
      ev.linkPncp,
      ev.arpInicial.url,
      linksAditivos,
    ];
    linhas.push(row.map(escaparCampoCsv).join(";"));
  }

  if (itensSelecionados.length > 0) {
    const media = soma / itensSelecionados.length;
    const mediaFmt = formatValorOuTaxa(media, criterioClassificacao).replace(/\u00A0/g, " ");
    const rowMedia = [
      ehDesconto ? "MÉDIA DAS TAXAS DE DESCONTO" : "MÉDIA DOS VALORES UNITÁRIOS",
      mediaFmt,
      "—",
      mediaFmt,
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
    ];
    linhas.push(rowMedia.map(escaparCampoCsv).join(";"));
  }

  linhas.push("");
  linhas.push(escaparCampoCsv(`DECLARAÇÃO DE INDEPENDÊNCIA INSTITUCIONAL: ${DECLARACAO_INDEPENDENCIA_TEXTO}`));
  linhas.push(escaparCampoCsv(`TERMO DE USO (DISCLAIMER): ${TERMO_DE_USO_DISCLAIMER_TEXTO}`));

  return `\uFEFF${linhas.join("\r\n")}\r\n`;
}
