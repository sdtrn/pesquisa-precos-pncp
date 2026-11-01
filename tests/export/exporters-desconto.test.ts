import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { gerarCsvConsolidado } from "../../src/lib/export/exporter-csv.ts";
import { gerarPlanilhaXlsx } from "../../src/lib/export/exporter-xlsx.ts";
import { gerarRelatorioPdfA4 } from "../../src/lib/export/exporter-pdf.ts";
import type { ItemCandidato, ResultadoPesquisa } from "../../src/lib/domain/types.ts";

function criarMockItem(overrides: Partial<ItemCandidato> = {}): ItemCandidato {
  return {
    item_url: "https://pncp.gov.br/app/atas/11222333000181/2025/10/1",
    link_ata_pncp: "https://pncp.gov.br/app/atas/11222333000181/2025/10/1",
    link_download_arp: "https://pncp.gov.br/api/pncp/v1/orgaos/11222333000181/compras/2025/10/arquivos/1",
    numero_controle_pncp: "11222333000181-1-000010/2025-000001",
    numero_arp_licitacao: "ARP 01/2025 (PE 10/2025)",
    orgao_gerenciador_uf: "Prefeitura Municipal do Recife/PE",
    esfera: "Municipal",
    tipo_orgao: "Administração Direta",
    cnpj_orgao: "11222333000181",
    fornecedor: "Empresa XPTO Ltda (CNPJ: 00.111.222/0001-33)",
    valor_unitario: 5.5, // 5.50% de desconto ou R$ 5,50
    descricao_objeto: "Gerenciamento e controle de frotas de veículos com abastecimento de combustível",
    data_assinatura: "15/01/2025",
    vigencia_ata: "12 meses",
    data_fim_vigencia: "15/01/2026",
    situacao_ata: "Vigente",
    aderencia: "Alta",
    detalhe_aderencia: "Correspondência exata",
    orgao_atende_validade: "Sim",
    quantitativo_previsto_arp: "1000",
    unidade_fornecimento: "taxa percentual (%)",
    numero_item_lote: "1",
    data_hora_consulta: "01/11/2026 10:00:00",
    escopo_escolhido: "Brasil (todos os órgãos)",
    status_escolhido: "Vigente",
    periodo_aplicado: "Último ano",
    termos_usados: "gerenciamento frota combustivel",
    ...overrides,
  };
}

function criarMockResultado(): ResultadoPesquisa {
  return {
    termo_original: "gerenciamento de frota",
    termos_busca: ["gerenciamento frota combustivel"],
    sinonimos_usados: [],
    escopo_orgaos: "Brasil (todos os órgãos)",
    status_ata: "Vigente",
    ano_inicio: 2025,
    ano_fim: 2026,
    periodo_aplicado_str: "Últimos 12 meses",
    total_atas_encontradas: 10,
    atas_validas_escopo_periodo: 8,
    total_itens_avaliados: 15,
    itens_filtrados: [criarMockItem()],
    itens_janela_top20: [criarMockItem()],
    candidatos_top20_ativos: [criarMockItem()],
    itens_selecionados: [criarMockItem()],
    indices_selecionados: [0],
    estatisticas: {
      media: 5.5,
      mediana: 5.5,
      menor: 5.5,
      maior: 5.5,
      desvioPadrao: 0,
      coeficienteVariacao: 0,
      quantidade: 1,
    },
    descartados: [],
    momento_consulta: "01/11/2026 10:00:00",
    criterio_classificacao: "maior_desconto",
  };
}

describe("Exporters com suporte a Taxa de Desconto (%)", () => {
  it("CSV: deve alternar cabeçalho e formatação entre menor_preco e maior_desconto", () => {
    const item = criarMockItem({ valor_unitario: 5.5 });

    // Preço
    const csvPreco = gerarCsvConsolidado([item], "menor_preco");
    assert.ok(csvPreco.includes("Valor Unitário (R$)"), "Deveria conter Valor Unitário (R$)");
    assert.ok(csvPreco.includes("5,50"), "Deveria conter 5,50");
    assert.ok(csvPreco.includes("MÉDIA DOS VALORES UNITÁRIOS"), "Deveria conter MÉDIA DOS VALORES UNITÁRIOS");

    // Desconto
    const csvDesconto = gerarCsvConsolidado([item], "maior_desconto");
    assert.ok(csvDesconto.includes("Taxa de Desconto (%)"), "Deveria conter Taxa de Desconto (%)");
    assert.ok(csvDesconto.includes("5,50%"), "Deveria conter 5,50%");
    assert.ok(csvDesconto.includes("MÉDIA DAS TAXAS DE DESCONTO"), "Deveria conter MÉDIA DAS TAXAS DE DESCONTO");
  });

  it("Excel (XLSX): deve formatar cabeçalhos e células percentuais quando maior_desconto", async () => {
    const item = criarMockItem({ valor_unitario: 7.25 });
    const buffer = await gerarPlanilhaXlsx([item], [item], [0], [], "maior_desconto");

    assert.ok(buffer instanceof Uint8Array, "Deveria gerar Uint8Array");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer.buffer as ArrayBuffer);

    const ws1 = wb.getWorksheet("Planilha_Parecer");
    assert.ok(ws1, "Planilha_Parecer deve existir");
    assert.equal(ws1.getCell("B1").value, "Taxa de Desconto (%)");
    assert.equal(ws1.getCell("A3").value, "MÉDIA DAS TAXAS DE DESCONTO");

    const ws2 = wb.getWorksheet("Memoria_de_Pesquisa");
    assert.ok(ws2, "Memoria_de_Pesquisa deve existir");
    assert.equal(ws2.getCell("C1").value, "Taxa de Desconto (%)");
  });

  it("PDF: deve gerar documento com cabeçalhos de taxa quando maior_desconto", async () => {
    const res = criarMockResultado();
    const item = criarMockItem({ valor_unitario: 4.8 });
    const pdfBytes = await gerarRelatorioPdfA4(res, [item], "Frota", "maior_desconto");

    assert.ok(pdfBytes instanceof Uint8Array, "Deveria retornar Uint8Array");
    const header = Buffer.from(pdfBytes.buffer.slice(0, 5)).toString("ascii");
    assert.equal(header, "%PDF-", "Deveria ser um PDF válido");
  });
});
