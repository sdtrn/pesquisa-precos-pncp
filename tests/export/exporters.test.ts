import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { gerarPlanilhaXlsx, sanitizarCelulaExcel } from "@/lib/export/exporter-xlsx";
import { gerarCsvConsolidado } from "@/lib/export/exporter-csv";
import { gerarRelatorioPdfA4 } from "@/lib/export/exporter-pdf";
import type { ItemCandidato, ResultadoPesquisa } from "@/lib/domain/types";

describe("Exportadores Auditáveis (.XLSX A4, .CSV e .PDF A4)", () => {
  it("escapa prefixos de fórmula (=, +, @) e caracteres ilegais XML", () => {
    expect(sanitizarCelulaExcel("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(sanitizarCelulaExcel("<p>Lona\x02 Preta</p>")).toBe("Lona Preta");
  });

  it("gera planilha .xlsx com 3 abas, fonte Arial e fórmula =AVERAGE(B2:B3)", async () => {
    const itens: Partial<ItemCandidato>[] = [
      {
        descricao_objeto: "Lona 8x100m 200 micras",
        valor_unitario: 800,
        numero_arp_licitacao: "ARP nº 10/2026",
        data_assinatura: "10/05/2026",
        orgao_gerenciador_uf: "Prefeitura do Recife/PE",
        fornecedor: "Empresa A (00.000.000/0001-00)",
        link_ata_pncp: "https://pncp.gov.br/app/atas/1/2026/1/1",
      },
      {
        descricao_objeto: "Lona 8x100m 200 micras",
        valor_unitario: 900,
        numero_arp_licitacao: "ARP nº 12/2026",
        data_assinatura: "12/05/2026",
        orgao_gerenciador_uf: "Governo de PE/PE",
        fornecedor: "Empresa B (11.111.111/0001-11)",
        link_ata_pncp: "https://pncp.gov.br/app/atas/2/2026/2/1",
      },
    ];

    const bytes = await gerarPlanilhaXlsx(
      itens as ItemCandidato[],
      itens as ItemCandidato[],
      [0, 1],
      []
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Planilha_Parecer",
      "Memoria_de_Pesquisa",
      "Descartados",
    ]);

    const ws1 = wb.getWorksheet("Planilha_Parecer")!;
    expect(ws1.getCell("A4").value).toBe("MÉDIA DOS VALORES UNITÁRIOS");
    expect(ws1.getCell("B4").value).toEqual({ formula: "AVERAGE(B2:B3)" });
    expect(ws1.getCell("B4").font?.name).toBe("Arial");
  });

  it("gera CSV com BOM UTF-8, separador ';' e linha final de média", () => {
    const csv = gerarCsvConsolidado([
      {
        descricao_objeto: "Item 1",
        valor_unitario: 500,
        numero_arp_licitacao: "ARP 1",
        data_assinatura: "01/01/2026",
        orgao_gerenciador_uf: "Órgão/PE",
        fornecedor: "Forn 1",
        link_ata_pncp: "https://pncp.gov.br",
      } as ItemCandidato,
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("MÉDIA DOS VALORES UNITÁRIOS;R$ 500,00");
  });

  it("gera Relatório Executivo em PDF (A4) válido com cabeçalho %PDF-", async () => {
    const item = {
      descricao_objeto: "Lona 8x100m 200 micras",
      valor_unitario: 850,
      numero_arp_licitacao: "ARP nº 10/2026",
      data_assinatura: "10/05/2026",
      orgao_gerenciador_uf: "Prefeitura do Recife/PE",
      fornecedor: "Empresa A",
      link_ata_pncp: "https://pncp.gov.br/app/atas/1/2026/1/1",
    } as ItemCandidato;

    const resMock: Partial<ResultadoPesquisa> = {
      momento_consulta: "31/10/2026 19:00:00",
      escopo_orgaos: "Critério de validade",
      status_ata: "Vigentes",
      periodo_aplicado_str: "Data de assinatura da ata: sem início a sem fim",
      termos_busca: ["lona"],
      requisitos: [],
      total_atas_encontradas: 50,
      atas_validas_escopo_periodo: 25,
      total_itens_avaliados: 100,
      conferencias_status_api: [],
      descartados: [],
    };

    const pdfBytes = await gerarRelatorioPdfA4(resMock as ResultadoPesquisa, [item]);
    const headerStr = new TextDecoder().decode(pdfBytes.slice(0, 5));
    expect(headerStr).toBe("%PDF-");
  });
});
