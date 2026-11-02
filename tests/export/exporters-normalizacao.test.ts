import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { gerarPlanilhaXlsx } from "../../src/lib/export/exporter-xlsx.ts";
import { gerarCsvConsolidado } from "../../src/lib/export/exporter-csv.ts";
import { gerarRelatorioPdfA4 } from "../../src/lib/export/exporter-pdf.ts";
import type { ItemCandidato, ResultadoPesquisa } from "../../src/lib/domain/types.ts";

function criarItemNormalizadoMock(overrides: Partial<ItemCandidato> = {}): ItemCandidato {
  return {
    descricao_objeto: "Posto de vigilância armada 44h semanais diurno (Lote com 3 postos)",
    valor_unitario: 12000,
    valor_original: 36000,
    unidade_original: "Lote com 3 postos",
    formula_normalizacao: "R$ 36.000,00 ÷ 3 postos = R$ 12.000,00/mês/posto",
    unidade_referencia: "R$/mês/posto",
    normalizado: true,
    quantitativo_previsto_arp: "1",
    quantidade_numerica_str: "1",
    unidade_fornecimento: "Lote com 3 postos",
    numero_arp_licitacao: "ARP nº 15/2026",
    id_ata_r6: "15/2026",
    orgao_gerenciador_uf: "Prefeitura Municipal de Vitória/ES",
    orgao_nome: "Prefeitura Municipal de Vitória",
    uf: "ES",
    municipio_nome: "Vitória",
    codigo_ibge: "3205309",
    fornecedor: "Segurança Total Ltda (00.123.456/0001-78)",
    numero_item_lote: "1",
    data_assinatura: "15/02/2026",
    vigencia_ata: "12 meses",
    data_fim_vigencia: "15/02/2027",
    situacao_ata: "Vigente",
    esfera: "Municipal",
    tipo_orgao: "Administração Direta",
    cnpj_orgao: "27142058000172",
    ano_compra: "2026",
    seq_compra: "1",
    seq_ata: "1",
    link_ata_pncp: "https://pncp.gov.br/app/atas/27142058000172/2026/1/1",
    aderencia: "A",
    detalhe_aderencia: "Atende a todos os requisitos",
    orgao_atende_validade: "Sim",
    data_hora_consulta: "02/11/2026 15:00:00",
    escopo_escolhido: "Brasil",
    status_escolhido: "Vigente",
    periodo_aplicado: "Último ano",
    termos_usados: "vigilancia armada posto",
    ...overrides,
  };
}

function criarResultadoMock(overrides: Partial<ResultadoPesquisa> = {}): ResultadoPesquisa {
  return {
    momento_consulta: "02/11/2026 15:00:00",
    escopo_orgaos: "Brasil (todos os órgãos)",
    status_ata: "Vigente",
    tipo_data_periodo: "assinatura",
    data_inicial: "2025-01-01",
    data_final: "2026-11-02",
    periodo_aplicado_str: "01/01/2025 a 02/11/2026",
    termos_busca: ["vigilancia armada posto"],
    requisitos: [],
    total_atas_encontradas: 10,
    atas_validas_escopo_periodo: 8,
    total_itens_avaliados: 12,
    conferencias_status_api: [],
    itens_candidatos: [criarItemNormalizadoMock()],
    descartados: [],
    resumo_descartes: {},
    modo_normalizacao_aplicado: "posto_mes",
    unidade_referencia_padrao: "R$/mês/posto",
    ...overrides,
  };
}

describe("Exportadores com Normalização de Preços Unitários (Lei nº 14.133/2021)", () => {
  it("XLSX: deve incluir cabeçalhos auditáveis de normalização, valores e fórmulas AVERAGE/MEDIAN", async () => {
    const item = criarItemNormalizadoMock();
    const bytes = await gerarPlanilhaXlsx(
      [item],
      [item],
      [0],
      [],
      "menor_preco",
      "R$/mês/posto"
    );

    assert.ok(bytes instanceof Uint8Array, "Deveria retornar Uint8Array");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);

    const ws1 = wb.getWorksheet("Planilha_Consolidada");
    assert.ok(ws1, "Aba Planilha_Consolidada deve existir");

    const row1Values: string[] = [];
    ws1.eachRow((r, rowNum) => {
      if (rowNum === 1) {
        r.eachCell((cell) => {
          row1Values.push(String(cell.value || ""));
        });
      }
    });

    // 1. Cabeçalhos de auditoria
    assert.ok(
      row1Values.some((h) => h.includes("Valor Unitário Normalizado")),
      `Cabeçalho de valor normalizado ausente: ${row1Values.join(", ")}`
    );
    assert.ok(
      row1Values.some((h) => h.includes("Memória de Cálculo")),
      `Cabeçalho de memória de cálculo ausente: ${row1Values.join(", ")}`
    );
    assert.ok(
      row1Values.some((h) => h.includes("Valor Homologado Original")),
      `Cabeçalho de valor homologado original ausente: ${row1Values.join(", ")}`
    );
    assert.ok(
      row1Values.some((h) => h.includes("Unidade Original ARP")),
      `Cabeçalho de unidade original ARP ausente: ${row1Values.join(", ")}`
    );

    // 2. Linha de dados (Linha 2)
    // Coluna 2: valor unitário normalizado (12000)
    assert.equal(Number(ws1.getCell("B2").value), 12000);
    // Coluna 3: memória de cálculo
    assert.ok(
      String(ws1.getCell("C2").value).includes("3 postos"),
      "Memória de cálculo na célula C2 deve indicar os 3 postos"
    );
    // Coluna 4: valor homologado original (36000)
    assert.equal(Number(ws1.getCell("D2").value), 36000);
    // Coluna 5: unidade original ARP ("Lote com 3 postos")
    assert.ok(
      String(ws1.getCell("E2").value).includes("Lote"),
      "Unidade original deve constar na célula E2"
    );

    // 3. Fórmulas de resumo apontando para coluna B (valor normalizado)
    assert.equal(ws1.getCell("A3").value, "MÉDIA DOS VALORES UNITÁRIOS");
    assert.deepEqual(ws1.getCell("B3").value, { formula: "AVERAGE(B2:B2)" });

    assert.equal(ws1.getCell("A4").value, "MEDIANA DOS VALORES UNITÁRIOS");
    assert.deepEqual(ws1.getCell("B4").value, { formula: "MEDIAN(B2:B2)" });
  });

  it("CSV: deve incluir colunas auditáveis e proteção contra CSV injection", () => {
    const item = criarItemNormalizadoMock({
      formula_normalizacao: "= 36000 / 3 postos", // Teste de tentativa de injeção de fórmula
    });

    const csv = gerarCsvConsolidado([item], "menor_preco");
    assert.ok(csv.startsWith("\uFEFF"), "Deve possuir UTF-8 BOM");

    const linhas = csv.split("\r\n");
    const cabecalho = linhas[0];

    // 1. Nomes das colunas no cabeçalho
    assert.ok(cabecalho.includes("valor_unitario_normalizado"), "Coluna valor_unitario_normalizado ausente");
    assert.ok(cabecalho.includes("formula_normalizacao"), "Coluna formula_normalizacao ausente");
    assert.ok(cabecalho.includes("valor_original_arp"), "Coluna valor_original_arp ausente");
    assert.ok(cabecalho.includes("unidade_original_arp"), "Coluna unidade_original_arp ausente");

    // 2. Dados da linha
    const linhaItem = linhas[1];
    assert.ok(linhaItem.includes("12.000,00"), "Valor normalizado formatado presente na linha");
    assert.ok(linhaItem.includes("36.000,00"), "Valor original presente na linha");
    assert.ok(linhaItem.includes("Lote com 3 postos"), "Unidade original presente na linha");

    // 3. Proteção contra CSV injection (prefixo ' para fórmulas iniciadas com =)
    assert.ok(
      linhaItem.includes("'= 36000 / 3 postos") || linhaItem.includes('"\'= 36000 / 3 postos"'),
      "Fórmula iniciada com '=' deve ser neutralizada com apóstrofo para evitar injeção"
    );
  });

  it("PDF: deve conter unidade de referência e memória de cálculo no relatório A4", async () => {
    const res = criarResultadoMock();
    const item = criarItemNormalizadoMock();

    const pdfBytes = await gerarRelatorioPdfA4(res, [item], "Vigilância Armada", "menor_preco");
    assert.ok(pdfBytes instanceof Uint8Array, "Deveria retornar Uint8Array");

    const header = Buffer.from(pdfBytes.buffer.slice(0, 5)).toString("ascii");
    assert.equal(header, "%PDF-", "Deve iniciar com cabeçalho PDF");

    const pdfText = Buffer.from(pdfBytes).toString("latin1");
    // Verifica presença da indicação de padronização
    assert.ok(
      pdfText.includes("Padroniza") || pdfText.includes("R$/m") || pdfText.includes("posto"),
      "PDF deve conter referência à padronização/unidade de referência"
    );
    // Verifica presença da fórmula na tabela
    assert.ok(
      pdfText.includes("14.133") || pdfText.includes("3 postos") || pdfText.includes("Mem") || pdfText.includes("ria"),
      "PDF deve conter indicador/memória de cálculo da normalização"
    );
  });
});
