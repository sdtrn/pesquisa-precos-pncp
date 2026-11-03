import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  calcularEstatisticasPrecos,
  formatValorOuTaxa,
} from "@/lib/domain/statistics";
import { formatarMoedaBr } from "@/lib/export/exporter-csv";
import {
  DECLARACAO_INDEPENDENCIA_TEXTO,
  TERMO_DE_USO_DISCLAIMER_TEXTO,
} from "@/data/constants";
import {
  descreverArquivosEvidenciaItem,
  sanitizarCelulaExcel,
} from "@/lib/export/exporter-xlsx";
import type {
  CriterioClassificacao,
  ItemCandidato,
  ResultadoPesquisa,
} from "@/lib/domain/types";

/**
 * Gera um Relatório Técnico Executivo em PDF (Folha A4 Retrato) pronto para juntada em
 * Processo Administrativo de Contratação (Lei nº 14.133/2021).
 */
export async function gerarRelatorioPdfA4(
  res: ResultadoPesquisa,
  itensSelecionados: ItemCandidato[],
  descricaoObjeto?: string,
  criterioClassificacao: CriterioClassificacao = "menor_preco"
): Promise<Uint8Array> {
  const ehDesconto = criterioClassificacao === "maior_desconto";
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
    ehDesconto
      ? "Levantamento Auditável de Taxas de Desconto Homologadas (Lei nº 14.133/2021 — IN SEGES/ME nº 65/2021)"
      : "Levantamento Auditável de Preços Unitários Homologados (Lei nº 14.133/2021 — IN SEGES/ME nº 65/2021)",
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

  const unidRefAtiva =
    res.unidade_referencia_padrao ||
    itensSelecionados.find((i) => i.unidade_referencia)?.unidade_referencia ||
    "R$";
  const modoNorm =
    res.modo_normalizacao_aplicado || res.modo_normalizacao_escolhido;

  let padronizacaoStr = "Não aplicada / Padrão (R$)";
  if (ehDesconto) {
    padronizacaoStr = "Desativada (Critério de Maior Desconto)";
  } else if (modoNorm === "posto_mes") {
    padronizacaoStr = `Mensal por Posto (${unidRefAtiva})`;
  } else if (modoNorm === "veiculo_mes") {
    padronizacaoStr = `Mensal por Veículo (${unidRefAtiva})`;
  } else if (unidRefAtiva !== "R$") {
    padronizacaoStr = `Padronização: ${unidRefAtiva}`;
  } else if (itensSelecionados.some((i) => i.normalizado)) {
    padronizacaoStr = `Padronização: ${unidRefAtiva}`;
  }

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
      ["Padronização de Preço", padronizacaoStr],
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
        ehDesconto ? "Média das Taxas" : "Média Unitária",
        "Mediana",
        ehDesconto ? "Menor Taxa" : "Menor Preço",
        ehDesconto ? "Maior Taxa" : "Maior Preço",
        "Desvio-Padrão",
        "Coef. Variação (CV)",
      ],
    ],
    body: [
      [
        String(stats.quantidade),
        formatValorOuTaxa(stats.media, criterioClassificacao),
        formatValorOuTaxa(stats.mediana, criterioClassificacao),
        formatValorOuTaxa(stats.menor, criterioClassificacao),
        formatValorOuTaxa(stats.maior, criterioClassificacao),
        formatValorOuTaxa(stats.desvioPadrao, criterioClassificacao),
        `${stats.coeficienteVariacao.toFixed(2).replace(".", ",")}%`,
      ],
    ],
    margin: { left: 12, right: 12 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 6;

  // Bloco 3: Tabela Consolidada de Preços / Taxas
  doc.setTextColor(27, 54, 93);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    "3. TABELA CONSOLIDADA DE PREÇOS / TAXAS DE DESCONTO HOMOLOGADAS",
    12,
    yPos
  );
  yPos += 2;

  const colValorHeader = ehDesconto
    ? "Taxa de Desconto (%)"
    : unidRefAtiva !== "R$"
    ? `Valor Unitário (${unidRefAtiva})`
    : "Valor Unitário (R$)";

  const bodyConsolidado = itensSelecionados.map((it) => {
    let desc = sanitizarCelulaExcel(it.descricao_objeto);
    if (it.formula_normalizacao) {
      desc += `\n[Memória de Cálculo (Lei 14.133/2021): ${it.formula_normalizacao}]`;
      if (it.valor_original !== undefined && it.valor_original !== it.valor_unitario) {
        const valOrigFmt = `R$ ${Number(it.valor_original).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
        desc += ` (Valor original na ARP: ${valOrigFmt})`;
      }
    }

    const numItemStr = it.numero_item_lote
      ? it.numero_item_lote.toLowerCase().includes("item")
        ? it.numero_item_lote
        : `Item ${it.numero_item_lote}`
      : "";
    const arpFmt = numItemStr
      ? `${sanitizarCelulaExcel(it.numero_arp_licitacao)}\n(${numItemStr})`
      : sanitizarCelulaExcel(it.numero_arp_licitacao);

    return [
      desc,
      formatValorOuTaxa(Number(it.valor_unitario || 0), criterioClassificacao),
      arpFmt,
      sanitizarCelulaExcel(it.data_assinatura || "não informado"),
      sanitizarCelulaExcel(it.orgao_gerenciador_uf),
      sanitizarCelulaExcel(it.fornecedor),
    ];
  });

  bodyConsolidado.push([
    ehDesconto ? "MÉDIA DAS TAXAS DE DESCONTO" : "MÉDIA DOS VALORES UNITÁRIOS",
    formatValorOuTaxa(stats.media, criterioClassificacao),
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
        colValorHeader,
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

  const bodyEvidencias: string[][] = [];
  itensSelecionados.forEach((it) => {
    const ev = descreverArquivosEvidenciaItem(it);
    const numItemStr = it.numero_item_lote
      ? it.numero_item_lote.toLowerCase().includes("item")
        ? it.numero_item_lote
        : `Item ${it.numero_item_lote}`
      : "";
    const arpBase = sanitizarCelulaExcel(it.numero_arp_licitacao);
    const arpTxt = numItemStr ? `${arpBase} (${numItemStr})` : arpBase;
    const orgaoTxt = sanitizarCelulaExcel(it.orgao_gerenciador_uf);
    const rotuloInicial =
      ev.termosAditivos.length > 0 ? `${arpTxt} (ARP Inicial)` : arpTxt;

    bodyEvidencias.push([
      rotuloInicial,
      orgaoTxt,
      ev.linkPncp,
      ev.arpInicial.url,
    ]);

    ev.termosAditivos.forEach((adit) => {
      bodyEvidencias.push([
        `${arpTxt} — ${adit.rotulo}`,
        orgaoTxt,
        ev.linkPncp,
        adit.url,
      ]);
    });
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
        "Nº da ARP / Licitação (e Termos Aditivos)",
        "Órgão Gerenciador/UF",
        "Link Direto da ARP no Portal PNCP",
        "Link Direto para Download do PDF (ARP Inicial / Termos Aditivos)",
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 8;
  if (yPos > 240) {
    doc.addPage();
    yPos = 18;
  }

  // Bloco 5: Declaração de Independência e Termo de Uso (Disclaimer)
  doc.setFillColor(254, 243, 199);
  if (typeof (doc as any).setDrawColor === "function") {
    (doc as any).setDrawColor(217, 119, 6);
  }
  doc.rect(12, yPos, pageWidth - 24, 28, "FD");

  doc.setTextColor(146, 64, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(
    "5. DECLARAÇÃO DE INDEPENDÊNCIA INSTITUCIONAL E TERMO DE USO (DISCLAIMER)",
    15,
    yPos + 5.5
  );

  const quebrarTexto = (txt: string, w: number) =>
    typeof (doc as any).splitTextToSize === "function"
      ? (doc as any).splitTextToSize(txt, w)
      : txt;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(30, 41, 59);
  doc.text(
    quebrarTexto(DECLARACAO_INDEPENDENCIA_TEXTO, pageWidth - 30),
    15,
    yPos + 10.5
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    quebrarTexto(TERMO_DE_USO_DISCLAIMER_TEXTO, pageWidth - 30),
    15,
    yPos + 17.5
  );

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
