import {
  descreverArquivosEvidenciaItem,
  sanitizarCelulaExcel,
} from "@/lib/export/exporter-xlsx";
import type { ItemCandidato } from "@/lib/domain/types";

export function formatarMoedaBr(valor: number): string {
  const num = Number.isFinite(valor) ? valor : 0;
  return `R$ ${num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escaparCampoCsv(val: string): string {
  if (val.includes(";") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Gera o conteúdo `.csv` da Tabela Consolidada (codificação UTF-8 com BOM e separador `;`),
 * contendo a coluna de Data de Assinatura, a média dos valores unitários e os links diretos
 * das ARPs iniciais e de seus eventuais Termos Aditivos.
 */
export function gerarCsvConsolidado(itensSelecionados: ItemCandidato[]): string {
  const linhas: string[] = [];
  const cabecalho = [
    "Descrição do objeto",
    "Valor Unitário (R$)",
    "Nº da ARP / Licitação",
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
    const valFmt = formatarMoedaBr(val);
    const ev = descreverArquivosEvidenciaItem(item);
    const linksAditivos =
      ev.termosAditivos.length > 0
        ? ev.termosAditivos.map((t) => `${t.rotulo}: ${t.url}`).join(" | ")
        : "Sem termos aditivos";

    const row = [
      sanitizarCelulaExcel(item.descricao_objeto),
      valFmt,
      sanitizarCelulaExcel(item.numero_arp_licitacao),
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
    const mediaFmt = formatarMoedaBr(media);
    const rowMedia = [
      "MÉDIA DOS VALORES UNITÁRIOS",
      mediaFmt,
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

  return `\uFEFF${linhas.join("\r\n")}\r\n`;
}
