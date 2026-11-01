import ExcelJS from "exceljs";
import { limparTextoExibicao } from "@/lib/domain/pipeline";
import type { ItemCandidato, RegistroDescartado } from "@/lib/domain/types";

/**
 * Remove caracteres de controle invisíveis ilegais na especificação XML do Excel,
 * limpa marcações HTML brutas vindas do PNCP e evita interpretação acidental
 * de texto como fórmula quebrada (=, +, @).
 */
export function sanitizarCelulaExcel(valor: unknown): string {
  const s = limparTextoExibicao(valor);
  if (!s) return "";
  if (s.startsWith("=") || s.startsWith("+") || s.startsWith("@")) {
    return `'${s}`;
  }
  return s;
}

function calcularAlturaLinhaA4(
  textosELarguras: Array<[string, number]>,
  alturaMinima = 24,
  alturaPorLinha = 13.5
): number {
  let maxLinhas = 1;
  for (const [texto, largCol] of textosELarguras) {
    const txtStr = String(texto || "");
    if (!txtStr || largCol <= 0) continue;
    const charsPorLinha = Math.max(8, Math.floor(largCol * 0.92));
    const linhasEstimadas = Math.ceil(txtStr.length / charsPorLinha);
    if (linhasEstimadas > maxLinhas) {
      maxLinhas = linhasEstimadas;
    }
  }
  return Math.max(alturaMinima, Math.min(180, maxLinhas * alturaPorLinha + 8));
}

export interface TermoAditivoEvidencia {
  rotulo: string;
  titulo: string;
  tipo: string;
  url: string;
}

export interface EvidenciaArquivosArp {
  linkPncp: string;
  arpInicial: {
    titulo: string;
    url: string;
  };
  termosAditivos: TermoAditivoEvidencia[];
  todosLinksTexto: string;
}

export function descreverArquivosEvidenciaItem(
  item: ItemCandidato
): EvidenciaArquivosArp {
  const linkPncp = sanitizarCelulaExcel(item.link_ata_pncp || "");
  const arquivosValidos = Array.isArray(item.arquivos_arp)
    ? item.arquivos_arp.filter((a) => Boolean(a && a.url))
    : [];

  const regexAdit =
    /aditiv|prorroga|apostil|renova|reajust|repactua|altera|errata|retifica/i;

  if (arquivosValidos.length === 0) {
    const linkDl = sanitizarCelulaExcel(item.link_download_arp || linkPncp);
    return {
      linkPncp,
      arpInicial: {
        titulo: "ARP Inicial",
        url: linkDl,
      },
      termosAditivos: [],
      todosLinksTexto: linkDl ? `ARP Inicial: ${linkDl}` : "",
    };
  }

  // Identifica qual documento é a ARP Inicial (primeiro documento que não seja explicitamente aditivo)
  let idxInicial = arquivosValidos.findIndex(
    (a) =>
      !a.ehTermoAditivo &&
      !regexAdit.test(String(a.titulo || "")) &&
      !regexAdit.test(String(a.tipo || ""))
  );
  if (idxInicial === -1) {
    idxInicial = 0;
  }

  const arqIni = arquivosValidos[idxInicial];
  const arpInicial = {
    titulo: sanitizarCelulaExcel(arqIni.titulo || "ARP Inicial"),
    url: sanitizarCelulaExcel(arqIni.url || linkPncp),
  };

  const termosAditivos: TermoAditivoEvidencia[] = [];
  let contadorAdit = 0;

  arquivosValidos.forEach((arq, i) => {
    if (i === idxInicial) return;
    contadorAdit++;
    const tit = sanitizarCelulaExcel(arq.titulo || "");
    const tip = sanitizarCelulaExcel(arq.tipo || "");
    const urlAdit = sanitizarCelulaExcel(arq.url || "");
    if (!urlAdit) return;

    let rotulo = "";
    if (regexAdit.test(tit)) {
      rotulo = tit;
    } else if (regexAdit.test(tip)) {
      rotulo =
        tit && tit.toLowerCase() !== tip.toLowerCase()
          ? `${tip} — ${tit}`
          : `${contadorAdit}º ${tip}`;
    } else {
      rotulo = tit
        ? `${contadorAdit}º Termo Aditivo / Doc. (${tit})`
        : `${contadorAdit}º Termo Aditivo`;
    }

    termosAditivos.push({
      rotulo,
      titulo: tit || rotulo,
      tipo: tip || "Termo Aditivo",
      url: urlAdit,
    });
  });

  const partesTxt = [
    `ARP Inicial (${arpInicial.titulo}): ${arpInicial.url}`,
    ...termosAditivos.map((t) => `${t.rotulo}: ${t.url}`),
  ];

  return {
    linkPncp,
    arpInicial,
    termosAditivos,
    todosLinksTexto: partesTxt.join(" | "),
  };
}

export function obterLinksEvidenciaItem(
  item: ItemCandidato
): [string, string, string] {
  const ev = descreverArquivosEvidenciaItem(item);
  return [ev.linkPncp, ev.arpInicial.url, ev.todosLinksTexto];
}

/**
 * Gera o arquivo `.xlsx` em memória (Uint8Array) com fonte Arial em todas as células,
 * diagramação ajustada para folha A4 e 3 abas:
 *   1. `Planilha_Parecer` (com fórmula =AVERAGE(B2:B{N}) e Quadro de Evidências)
 *   2. `Memoria_de_Pesquisa`
 *   3. `Descartados`
 */
export async function gerarPlanilhaXlsx(
  itensSelecionados: ItemCandidato[],
  itensJanelaTop20: ItemCandidato[],
  indicesSelecionados: number[],
  descartados: RegistroDescartado[]
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema de Pesquisa de Preços PNCP — Sérgio Dantas Torres";
  wb.created = new Date();

  const fontHeaderA4: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 9,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  const fontBodyA4: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 9,
    bold: false,
    color: { argb: "FF111111" },
  };
  const fontBoldA4: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 9,
    bold: true,
    color: { argb: "FF1B365D" },
  };
  const fontLinkA4: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 9,
    underline: true,
    color: { argb: "FF1B365D" },
  };

  const fontHeader: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 10,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  const fontBody: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 10,
    bold: false,
    color: { argb: "FF111111" },
  };
  const fontLink: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 10,
    underline: true,
    color: { argb: "FF1B365D" },
  };

  const fillHeader: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B365D" },
  };
  const fillSubHeader: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2C4C7E" },
  };
  const fillMedia: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF4EFE0" },
  };
  const fillZebra: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };

  const borderCell: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  const borderMedia: Partial<ExcelJS.Borders> = {
    top: { style: "medium", color: { argb: "FFB59410" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "double", color: { argb: "FFB59410" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  const moedaFormat = "R$ #,##0.00";

  // =========================================================================
  // ABA 1: Planilha_Parecer (Diagramada para Folha A4)
  // =========================================================================
  const ws1 = wb.addWorksheet("Planilha_Parecer", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.45,
        bottom: 0.5,
        header: 0.25,
        footer: 0.25,
      },
    },
    headerFooter: {
      oddFooter:
        "&LPesquisa de Preços em Atas — PNCP (Lei nº 14.133/2021)&RDesenvolvido por Sérgio Dantas Torres",
    },
  });

  const largurasAba1 = [34, 14, 19, 13, 19, 19];
  ws1.columns = [
    { width: largurasAba1[0] },
    { width: largurasAba1[1] },
    { width: largurasAba1[2] },
    { width: largurasAba1[3] },
    { width: largurasAba1[4] },
    { width: largurasAba1[5] },
  ];

  const headersAba1 = [
    "Descrição do objeto",
    "Valor Unitário (R$)",
    "Nº da ARP / Licitação",
    "Data de Assinatura",
    "Órgão Gerenciador/UF",
    "Fornecedor",
  ];
  const rowHeader1 = ws1.addRow(headersAba1);
  rowHeader1.height = 26;
  rowHeader1.eachCell((cell) => {
    cell.font = fontHeaderA4;
    cell.fill = fillHeader;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = borderCell;
  });

  let rowNum = 2;
  itensSelecionados.forEach((item, idx) => {
    const descTxt = sanitizarCelulaExcel(item.descricao_objeto);
    const valUnit = Number(item.valor_unitario || 0);
    const arpTxt = sanitizarCelulaExcel(item.numero_arp_licitacao);
    const dtAssTxt = sanitizarCelulaExcel(
      item.data_assinatura || "não informado"
    );
    const orgaoTxt = sanitizarCelulaExcel(item.orgao_gerenciador_uf);
    const fornTxt = sanitizarCelulaExcel(item.fornecedor);
    const [linkPncp] = obterLinksEvidenciaItem(item);

    const r = ws1.addRow([
      descTxt,
      valUnit,
      arpTxt,
      dtAssTxt,
      orgaoTxt,
      fornTxt,
    ]);
    r.height = calcularAlturaLinhaA4([
      [descTxt, largurasAba1[0]],
      [arpTxt, largurasAba1[2]],
      [orgaoTxt, largurasAba1[4]],
      [fornTxt, largurasAba1[5]],
    ]);

    for (let colIdx = 1; colIdx <= 6; colIdx++) {
      const c = r.getCell(colIdx);
      c.font = fontBodyA4;
      c.border = borderCell;
      if (idx % 2 === 1) {
        c.fill = fillZebra;
      }
      if (colIdx === 2) {
        c.numFmt = moedaFormat;
        c.alignment = { horizontal: "right", vertical: "middle", wrapText: false };
      } else if (colIdx === 3) {
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        if (linkPncp.startsWith("http")) {
          c.value = { text: arpTxt, hyperlink: linkPncp };
          c.font = fontLinkA4;
        }
      } else if (colIdx === 4) {
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      } else {
        c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      }
    }
    rowNum++;
  });

  // Linha final: MÉDIA DOS VALORES UNITÁRIOS com FÓRMULA =AVERAGE(B2:B{N})
  const ultimaLinhaDados = Math.max(2, rowNum - 1);
  const formulaMedia =
    itensSelecionados.length > 0
      ? { formula: `AVERAGE(B2:B${ultimaLinhaDados})` }
      : { formula: "0" };

  const rowMedia = ws1.addRow([
    "MÉDIA DOS VALORES UNITÁRIOS",
    formulaMedia,
    "—",
    "—",
    "—",
    "—",
  ]);
  rowMedia.height = 25;
  for (let colIdx = 1; colIdx <= 6; colIdx++) {
    const c = rowMedia.getCell(colIdx);
    c.font = fontBoldA4;
    c.fill = fillMedia;
    c.border = borderMedia;
    if (colIdx === 2) {
      c.numFmt = moedaFormat;
      c.alignment = { horizontal: "right", vertical: "middle", wrapText: false };
    } else if (colIdx >= 3) {
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    } else {
      c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    }
  }

  // Quadro complementar na Aba 1: Links diretos das ARPs selecionadas
  if (itensSelecionados.length > 0) {
    ws1.addRow([]);
    const rowTitEv = ws1.addRow([
      "EVIDÊNCIAS E PAPÉIS DE TRABALHO — LINKS DIRETOS DE ACESSO E DOWNLOAD DAS ARPs SELECIONADAS",
      "",
      "",
      "",
      "",
      "",
    ]);
    const titRowNumber = rowTitEv.number;
    ws1.mergeCells(titRowNumber, 1, titRowNumber, 6);
    rowTitEv.height = 22;
    for (let colI = 1; colI <= 6; colI++) {
      const c = rowTitEv.getCell(colI);
      c.font = fontBoldA4;
      c.fill = fillMedia;
      c.border = borderCell;
      c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    }

    const rowHeadEv = ws1.addRow([
      "Nº da ARP / Licitação (e Termos Aditivos)",
      "Data de Assinatura",
      "Órgão Gerenciador/UF",
      "Link Direto da ARP no Portal PNCP",
      "Link Direto para Download do PDF (ARP Inicial / Termos Aditivos)",
      "",
    ]);
    const headEvNum = rowHeadEv.number;
    ws1.mergeCells(headEvNum, 5, headEvNum, 6);
    rowHeadEv.height = 22;
    for (let colI = 1; colI <= 6; colI++) {
      const c = rowHeadEv.getCell(colI);
      c.font = fontHeaderA4;
      c.fill = fillSubHeader;
      c.border = borderCell;
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }

    const adicionarLinhaEvidenciaA4 = (
      col1Txt: string,
      dtAssTxt: string,
      orgaoTxt: string,
      linkPncp: string,
      linkPdf: string,
      usarZebra: boolean
    ) => {
      const rEv = ws1.addRow([
        col1Txt,
        dtAssTxt,
        orgaoTxt,
        linkPncp,
        linkPdf,
        "",
      ]);
      const evNum = rEv.number;
      ws1.mergeCells(evNum, 5, evNum, 6);
      rEv.height = 22;

      for (let colI = 1; colI <= 6; colI++) {
        const ce = rEv.getCell(colI);
        ce.font = fontBodyA4;
        ce.border = borderCell;
        if (usarZebra) {
          ce.fill = fillZebra;
        }
        if (colI === 2) {
          ce.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
        } else if (colI === 4 && linkPncp.startsWith("http")) {
          ce.value = { text: linkPncp, hyperlink: linkPncp };
          ce.font = fontLinkA4;
          ce.alignment = {
            horizontal: "left",
            vertical: "middle",
            wrapText: true,
          };
        } else if (colI === 5 && linkPdf.startsWith("http")) {
          ce.value = { text: linkPdf, hyperlink: linkPdf };
          ce.font = fontLinkA4;
          ce.alignment = {
            horizontal: "left",
            vertical: "middle",
            wrapText: true,
          };
        } else {
          ce.alignment = {
            horizontal: "left",
            vertical: "middle",
            wrapText: true,
          };
        }
      }
    };

    itensSelecionados.forEach((item, idxE) => {
      const arpTxt = sanitizarCelulaExcel(item.numero_arp_licitacao);
      const dtAssTxt = sanitizarCelulaExcel(
        item.data_assinatura || "não informado"
      );
      const orgaoTxt = sanitizarCelulaExcel(item.orgao_gerenciador_uf);
      const ev = descreverArquivosEvidenciaItem(item);
      const usarZebra = idxE % 2 === 1;

      const rotuloArpInicial =
        ev.termosAditivos.length > 0 ? `${arpTxt} (ARP Inicial)` : arpTxt;
      adicionarLinhaEvidenciaA4(
        rotuloArpInicial,
        dtAssTxt,
        orgaoTxt,
        ev.linkPncp,
        ev.arpInicial.url,
        usarZebra
      );

      ev.termosAditivos.forEach((adit) => {
        adicionarLinhaEvidenciaA4(
          `${arpTxt} — ${adit.rotulo}`,
          dtAssTxt,
          orgaoTxt,
          ev.linkPncp,
          adit.url,
          usarZebra
        );
      });
    });
  }

  // =========================================================================
  // ABA 2: Memoria_de_Pesquisa
  // =========================================================================
  const ws2 = wb.addWorksheet("Memoria_de_Pesquisa");
  const largurasAba2 = [
    18, 52, 20, 24, 16, 16, 34, 30, 34, 18, 26, 20, 22, 16, 28, 20, 42, 42, 48,
    14, 44, 24, 22, 26, 18, 34, 28,
  ];
  ws2.columns = largurasAba2.map((w) => ({ width: w }));

  const headersAba2 = [
    "Selecionado (Sim/Não)",
    "Descrição do objeto",
    "Valor Unitário (R$)",
    "Quantitativo previsto na ARP",
    "Unidade",
    "Nº do Item/Lote",
    "Nº da ARP / Licitação",
    "Órgão Gerenciador/UF",
    "Fornecedor",
    "Data de assinatura",
    "Vigência da ata",
    "Data final de vigência",
    "Situação da ata",
    "Esfera",
    "Tipo de órgão",
    "CNPJ do órgão",
    "Link da ata no PNCP",
    "Link Direto Download PDF da ARP Inicial",
    "Links Diretos dos Termos Aditivos da ARP",
    "Aderência",
    "Detalhamento da Aderência",
    "Órgão atende ao critério de validade (Sim/Não)",
    "Data/hora da consulta",
    "Escopo dos órgãos escolhido",
    "Status filtrado",
    "Período aplicado",
    "Termos usados na busca",
  ];
  const rHead2 = ws2.addRow(headersAba2);
  rHead2.height = 28;
  rHead2.eachCell((c) => {
    c.font = fontHeader;
    c.fill = fillHeader;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = borderCell;
  });

  const setIndicesSel = new Set(indicesSelecionados);
  itensJanelaTop20.forEach((item, idx) => {
    const foiSelecionado = setIndicesSel.has(idx) ? "Sim" : "Não";
    const ev = descreverArquivosEvidenciaItem(item);
    const linkUrl = ev.linkPncp;
    const linkPdfUrl = ev.arpInicial.url;
    const linksAditivosTxt =
      ev.termosAditivos.length > 0
        ? ev.termosAditivos.map((t) => `${t.rotulo}: ${t.url}`).join(" | ")
        : "Sem termos aditivos";
    const primeiroLinkAditivo = ev.termosAditivos[0]?.url || "";

    const r = ws2.addRow([
      foiSelecionado,
      sanitizarCelulaExcel(item.descricao_objeto),
      Number(item.valor_unitario || 0),
      sanitizarCelulaExcel(item.quantitativo_previsto_arp || "não informado"),
      sanitizarCelulaExcel(item.unidade_fornecimento || "não informado"),
      sanitizarCelulaExcel(item.numero_item_lote),
      sanitizarCelulaExcel(item.numero_arp_licitacao),
      sanitizarCelulaExcel(item.orgao_gerenciador_uf),
      sanitizarCelulaExcel(item.fornecedor),
      sanitizarCelulaExcel(item.data_assinatura || "não informado"),
      sanitizarCelulaExcel(item.vigencia_ata || "não informado"),
      sanitizarCelulaExcel(item.data_fim_vigencia || "não informado"),
      sanitizarCelulaExcel(item.situacao_ata),
      sanitizarCelulaExcel(item.esfera),
      sanitizarCelulaExcel(item.tipo_orgao),
      sanitizarCelulaExcel(item.cnpj_orgao),
      linkUrl,
      linkPdfUrl,
      linksAditivosTxt,
      sanitizarCelulaExcel(item.aderencia),
      sanitizarCelulaExcel(item.detalhe_aderencia),
      sanitizarCelulaExcel(item.orgao_atende_validade),
      sanitizarCelulaExcel(item.data_hora_consulta),
      sanitizarCelulaExcel(item.escopo_escolhido),
      sanitizarCelulaExcel(item.status_escolhido),
      sanitizarCelulaExcel(item.periodo_aplicado),
      sanitizarCelulaExcel(item.termos_usados),
    ]);
    r.height = 36;

    for (let colIdx = 1; colIdx <= headersAba2.length; colIdx++) {
      const c = r.getCell(colIdx);
      c.font = fontBody;
      c.border = borderCell;
      if (foiSelecionado === "Sim") {
        c.fill = fillMedia;
      } else if (idx % 2 === 1) {
        c.fill = fillZebra;
      }

      if (colIdx === 3) {
        c.numFmt = moedaFormat;
        c.alignment = { horizontal: "right", vertical: "middle", wrapText: false };
      } else if (colIdx === 6) {
        c.numFmt = "@";
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      } else if (colIdx === 17 && linkUrl.startsWith("http")) {
        c.value = { text: linkUrl, hyperlink: linkUrl };
        c.font = fontLink;
        c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      } else if (colIdx === 18 && linkPdfUrl.startsWith("http")) {
        c.value = { text: linkPdfUrl, hyperlink: linkPdfUrl };
        c.font = fontLink;
        c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      } else if (colIdx === 19 && primeiroLinkAditivo.startsWith("http")) {
        c.value = { text: linksAditivosTxt, hyperlink: primeiroLinkAditivo };
        c.font = fontLink;
        c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      } else if (
        [1, 4, 5, 10, 11, 12, 13, 14, 16, 20, 22].includes(colIdx)
      ) {
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      } else {
        c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      }
    }
  });

  // =========================================================================
  // ABA 3: Descartados
  // =========================================================================
  const ws3 = wb.addWorksheet("Descartados");
  const largurasAba3 = [16, 48, 34, 32, 16, 22, 16, 52, 20, 16, 18, 26, 22, 42];
  ws3.columns = largurasAba3.map((w) => ({ width: w }));

  const headersAba3 = [
    "Nível (Ata/Item)",
    "Motivo do Descarte",
    "Nº da ARP / Controle PNCP",
    "Órgão Gerenciador/UF",
    "Esfera",
    "Município",
    "Nº do Item/Lote",
    "Descrição do Objeto / Item",
    "Valor Unitário (R$)",
    "Unidade",
    "Data de Assinatura",
    "Vigência da Ata",
    "Situação da Ata",
    "Link no PNCP",
  ];
  const rHead3 = ws3.addRow(headersAba3);
  rHead3.height = 26;
  rHead3.eachCell((c) => {
    c.font = fontHeader;
    c.fill = fillHeader;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = borderCell;
  });

  descartados.forEach((desc) => {
    const valU = desc["Valor Unitário (R$)"];
    const valNum =
      valU !== null && valU !== undefined && Number.isFinite(Number(valU))
        ? Number(valU)
        : null;

    const r = ws3.addRow([
      sanitizarCelulaExcel(desc.Nível),
      sanitizarCelulaExcel(desc["Motivo do Descarte"]),
      sanitizarCelulaExcel(desc["Nº da ARP / Controle PNCP"]),
      sanitizarCelulaExcel(desc["Órgão Gerenciador/UF"]),
      sanitizarCelulaExcel(desc.Esfera),
      sanitizarCelulaExcel(desc.Município),
      sanitizarCelulaExcel(desc["Nº do Item/Lote"] || "-"),
      sanitizarCelulaExcel(desc["Descrição do Objeto / Item"]),
      valNum !== null ? valNum : "-",
      sanitizarCelulaExcel(desc.Unidade || "-"),
      sanitizarCelulaExcel(desc["Data de Assinatura"] || "não informado"),
      sanitizarCelulaExcel(desc["Vigência da Ata"] || "não informado"),
      sanitizarCelulaExcel(desc["Situação da Ata"]),
      sanitizarCelulaExcel(desc["Link no PNCP"]),
    ]);
    r.height = 28;

    for (let colIdx = 1; colIdx <= headersAba3.length; colIdx++) {
      const c = r.getCell(colIdx);
      c.font = fontBody;
      c.border = borderCell;
      if (colIdx === 7) {
        c.numFmt = "@";
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      } else if (colIdx === 9 && valNum !== null) {
        c.numFmt = moedaFormat;
        c.alignment = { horizontal: "right", vertical: "middle", wrapText: false };
      } else if ([1, 5, 6, 10, 11, 12, 13].includes(colIdx)) {
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      } else {
        c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      }
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
