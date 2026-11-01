import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { calcularEstatisticasPrecos } from "@/lib/domain/statistics";
import { formatarMoedaBr } from "@/lib/export/exporter-csv";
import {
  obterLinksEvidenciaItem,
  sanitizarCelulaExcel,
} from "@/lib/export/exporter-xlsx";
import type { ItemCandidato, ResultadoPesquisa } from "@/lib/domain/types";

/**
 * Gera um Relatório Técnico Executivo em PDF (Folha A4 Retrato) pronto para juntada em
 * Parecer Técnico / Processo Administrativo (Lei nº 14.133/2021).
 */
export async function gerarRelatorioPdfA4(
  res: ResultadoPesquisa,
  itensSelecionados: ItemCandidato[],
  descricaoObjeto?: string
): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const stats = calcularEstatisticasPrecos(
    itensSelecionados.map((i) => i.valor_unitario)
  );

  // Faixa de Cabeçalho Institucional (#1B365D com filete dourado #B59410)
  doc.setFillColor(27, 54, 93);
  doc.rect(0, 0, pageWidth, 27, "F");
  doc.setFillColor(181, 148, 16);
  doc.rect(0, 27, pageWidth, 1.8, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    "RELATÓRIO TÉCNICO DE PESQUISA DE PREÇOS EM ATAS DO PNCP",
    12,
    11
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    "Levantamento Auditável de Preços Unitários Homologados (Lei nº 14.133/2021 — IN SEGES/ME nº 65/2021)",
    12,
    17
  );
  doc.text(
    `Consulta realizada em: ${res.momento_consulta} (America/Recife)  |  Desenvolvido por Sérgio Dantas Torres`,
    12,
    22.5
  );

  let yPos = 34;

  // Bloco 1: Parâmetros de Auditoria
  doc.setTextColor(27, 54, 93);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("1. PARÂMETROS E RASTREABILIDADE DA PESQUISA", 12, yPos);
  yPos += 2;

  const escopoStr =
    res.regiao_selecionada && res.escopo_orgaos.includes("Região")
      ? `${res.escopo_orgaos} — Região: ${res.regiao_selecionada} (${
          res.apenas_municipios_bilionarios === false
            ? "Todos os municípios"
            : "Municípios ≥ R$ 1 bi"
        })`
      : res.uf_selecionada && res.escopo_orgaos.includes("Estado")
      ? `${res.escopo_orgaos} — UF: ${res.uf_selecionada}`
      : res.escopo_orgaos;

  autoTable(doc, {
    startY: yPos,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2,
      textColor: [17, 17, 17],
    },
    headStyles: {
      fillColor: [44, 76, 126],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    body: [
      [
        "Objeto Pesquisado",
        sanitizarCelulaExcel(
          descricaoObjeto ||
            itensSelecionados[0]?.descricao_objeto ||
            res.termos_busca.join(", ")
        ),
      ],
      ["Escopo dos Órgãos", escopoStr],
      ["Status / Período", `${res.status_ata} | ${res.periodo_aplicado_str}`],
      ["Termos Consultados no PNCP", res.termos_busca.join(", ")],
      [
        "Funil de Auditoria",
        `Atas Encontradas: ${res.total_atas_encontradas}  |  No Escopo/Período: ${res.atas_validas_escopo_periodo}  |  Itens Avaliados: ${res.total_itens_avaliados}  |  Descartados: ${res.descartados.length}`,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 46, fontStyle: "bold", fillColor: [241, 245, 249] },
      1: { cellWidth: 140 },
    },
    margin: { left: 12, right: 12 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 6;

  // Bloco 2: Quadro Estatístico
  doc.setTextColor(27, 54, 93);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("2. SÍNTESE ESTATÍSTICA DA CESTA DE PREÇOS SELECIONADA", 12, yPos);
  yPos += 2;

  autoTable(doc, {
    startY: yPos,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      halign: "center",
      cellPadding: 2.2,
    },
    headStyles: {
      fillColor: [27, 54, 93],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    head: [
      [
        "Qtd. ARPs",
        "Média Unitária",
        "Mediana",
        "Menor Preço",
        "Maior Preço",
        "Desvio-Padrão",
        "Coef. Variação (CV)",
      ],
    ],
    body: [
      [
        String(stats.quantidade),
        formatarMoedaBr(stats.media),
        formatarMoedaBr(stats.mediana),
        formatarMoedaBr(stats.menor),
        formatarMoedaBr(stats.maior),
        formatarMoedaBr(stats.desvioPadrao),
        `${stats.coeficienteVariacao.toFixed(2).replace(".", ",")}%`,
      ],
    ],
    margin: { left: 12, right: 12 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 6;

  // Bloco 3: Tabela Consolidada para o Parecer Técnico
  doc.setTextColor(27, 54, 93);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    "3. TABELA CONSOLIDADA — TÓPICO 'PESQUISA DE PREÇOS' DO PARECER TÉCNICO",
    12,
    yPos
  );
  yPos += 2;

  const bodyConsolidado = itensSelecionados.map((it) => [
    sanitizarCelulaExcel(it.descricao_objeto),
    formatarMoedaBr(Number(it.valor_unitario || 0)),
    sanitizarCelulaExcel(it.numero_arp_licitacao),
    sanitizarCelulaExcel(it.data_assinatura || "não informado"),
    sanitizarCelulaExcel(it.orgao_gerenciador_uf),
    sanitizarCelulaExcel(it.fornecedor),
  ]);

  bodyConsolidado.push([
    "MÉDIA DOS VALORES UNITÁRIOS",
    formatarMoedaBr(stats.media),
    "—",
    "—",
    "—",
    "—",
  ]);

  autoTable(doc, {
    startY: yPos,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [17, 17, 17],
      valign: "middle",
    },
    headStyles: {
      fillColor: [27, 54, 93],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    head: [
      [
        "Descrição do objeto",
        "Valor Unitário (R$)",
        "Nº da ARP / Licitação",
        "Data de Assinatura",
        "Órgão Gerenciador/UF",
        "Fornecedor",
      ],
    ],
    body: bodyConsolidado,
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 25, halign: "right", fontStyle: "bold" },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 28 },
      5: { cellWidth: 27 },
    },
    didParseCell: (data) => {
      if (
        data.section === "body" &&
        data.row.index === bodyConsolidado.length - 1
      ) {
        data.cell.styles.fillColor = [244, 239, 224];
        data.cell.styles.textColor = [27, 54, 93];
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 12, right: 12 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 6;

  // Bloco 4: Quadro de Links Diretos e Evidências
  if (yPos > 245) {
    doc.addPage();
    yPos = 18;
  }

  doc.setTextColor(27, 54, 93);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    "4. EVIDÊNCIAS E PAPÉIS DE TRABALHO — LINKS DIRETOS DAS ARPs NO PNCP",
    12,
    yPos
  );
  yPos += 2;

  const bodyEvidencias = itensSelecionados.map((it) => {
    const [linkPncp, linkPdf] = obterLinksEvidenciaItem(it);
    return [
      sanitizarCelulaExcel(it.numero_arp_licitacao),
      sanitizarCelulaExcel(it.orgao_gerenciador_uf),
      linkPncp,
      linkPdf,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.8,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [44, 76, 126],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    head: [
      [
        "Nº da ARP / Licitação",
        "Órgão Gerenciador/UF",
        "Link Direto da ARP no Portal PNCP",
        "Link Direto para Download do PDF da ARP",
      ],
    ],
    body: bodyEvidencias,
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 34 },
      2: { cellWidth: 59, textColor: [27, 54, 93] },
      3: { cellWidth: 59, textColor: [140, 109, 8] },
    },
    margin: { left: 12, right: 12 },
  });

  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Pesquisa de Preços em Atas — PNCP (Lei nº 14.133/2021) | Página ${i} de ${pageCount}`,
      12,
      290
    );
    doc.text(
      "Desenvolvido por Sérgio Dantas Torres",
      pageWidth - 12,
      290,
      { align: "right" }
    );
  }

  const arrayBuf = doc.output("arraybuffer");
  return new Uint8Array(arrayBuf);
}
