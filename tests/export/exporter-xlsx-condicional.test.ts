import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { gerarPlanilhaXlsx } from "../../src/lib/export/exporter-xlsx.ts";
import type { ItemCandidato } from "../../src/lib/domain/types.ts";

function criarItemBase(overrides: Partial<ItemCandidato> = {}): ItemCandidato {
  return {
    descricao_objeto: "Notebook 16GB SSD 512GB",
    valor_unitario: 4500,
    quantitativo_previsto_arp: "100",
    quantidade_numerica_str: "100",
    unidade_fornecimento: "Unidade",
    numero_arp_licitacao: "ARP nº 10/2026",
    id_ata_r6: "10/2026",
    orgao_gerenciador_uf: "Prefeitura Municipal de Curitiba/PR",
    orgao_nome: "Prefeitura Municipal de Curitiba",
    uf: "PR",
    municipio_nome: "Curitiba",
    codigo_ibge: "4106902",
    fornecedor: "Tech Supply Ltda (12.345.678/0001-90)",
    numero_item_lote: "1",
    data_assinatura: "10/02/2026",
    vigencia_ata: "12 meses",
    data_fim_vigencia: "10/02/2027",
    situacao_ata: "Vigente",
    possibilidade_adesao: "Sim",
    esfera: "Municipal",
    tipo_orgao: "Administração Direta",
    cnpj_orgao: "76417005000186",
    ano_compra: "2026",
    seq_compra: "1",
    seq_ata: "1",
    link_ata_pncp: "https://pncp.gov.br/app/atas/76417005000186/2026/1/1",
    aderencia: "A",
    detalhe_aderencia: "Atende plenamente",
    orgao_atende_validade: "Sim",
    data_hora_consulta: "06/11/2026 10:00:00",
    escopo_escolhido: "Brasil",
    status_escolhido: "Vigente",
    periodo_aplicado: "Último ano",
    termos_usados: "notebook",
    ...overrides,
  };
}

describe("Exportador XLSX — Condicionalidade de Padronização e Possibilidade de Adesão (Aba 1)", () => {
  it("Cesta SEM padronização: omite colunas de cálculo/original/unidade, inclui Possibilidade de Adesão e fórmula aponta para coluna B", async () => {
    const item1 = criarItemBase({
      descricao_objeto: "Notebook Dell Core i7",
      valor_unitario: 5000,
      possibilidade_adesao: "Sim",
      fornecedor: "Fornecedor Alpha (11.111.111/0001-11)",
    });
    const item2 = criarItemBase({
      descricao_objeto: "Notebook Lenovo Core i7",
      valor_unitario: 4800,
      possibilidade_adesao: "Não",
      fornecedor: "Fornecedor Beta (22.222.222/0001-22)",
    });

    const bytes = await gerarPlanilhaXlsx([item1, item2], [item1, item2], [0, 1], []);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);

    const ws1 = wb.getWorksheet("Planilha_Consolidada");
    assert.ok(ws1, "Aba Planilha_Consolidada deve existir");

    const headersAba1: string[] = [];
    ws1.eachRow((r, rowNum) => {
      if (rowNum === 1) {
        r.eachCell((cell) => {
          headersAba1.push(String(cell.value || ""));
        });
      }
    });

    // 1. Cabeçalhos esperados sem padronização (7 colunas)
    assert.deepEqual(headersAba1, [
      "Descrição do objeto",
      "Valor Unitário (R$)",
      "Nº da ARP / Licitação",
      "Possibilidade de Adesão",
      "Data de Assinatura",
      "Órgão Gerenciador/UF",
      "Fornecedor",
    ]);

    // Não deve conter colunas de padronização
    assert.ok(!headersAba1.includes("Memória de Cálculo (Lei 14.133/2021)"));
    assert.ok(!headersAba1.includes("Valor Homologado Original (R$)"));
    assert.ok(!headersAba1.includes("Unidade Original ARP"));

    // 2. Valores das linhas de dados
    assert.equal(ws1.getCell("A2").value, "Notebook Dell Core i7");
    assert.equal(Number(ws1.getCell("B2").value), 5000);
    assert.equal(ws1.getCell("D2").value, "Sim");
    assert.equal(ws1.getCell("G2").value, "Fornecedor Alpha (11.111.111/0001-11)");

    assert.equal(ws1.getCell("A3").value, "Notebook Lenovo Core i7");
    assert.equal(Number(ws1.getCell("B3").value), 4800);
    assert.equal(ws1.getCell("D3").value, "Não");
    assert.equal(ws1.getCell("G3").value, "Fornecedor Beta (22.222.222/0001-22)");

    // 3. Fórmulas de resumo na linha 4 apontando para a Coluna B
    assert.equal(ws1.getCell("A4").value, "MÉDIA DOS VALORES UNITÁRIOS");
    assert.deepEqual(ws1.getCell("B4").value, { formula: "AVERAGE(B2:B3)" });

    assert.equal(ws1.getCell("A5").value, "MEDIANA DOS VALORES UNITÁRIOS");
    assert.deepEqual(ws1.getCell("B5").value, { formula: "MEDIAN(B2:B3)" });
  });

  it("Cesta COM padronização: inclui colunas de memória e valor original, inclui Adesão, NÃO inclui Unidade Original ARP, fórmula aponta para coluna B", async () => {
    const itemNormalizado1 = criarItemBase({
      descricao_objeto: "Posto Vigilância Diurna (Lote 2 postos)",
      valor_unitario: 10000,
      valor_original: 20000,
      unidade_original: "Lote 2 postos",
      formula_normalizacao: "R$ 20.000,00 ÷ 2 postos = R$ 10.000,00/mês/posto",
      unidade_referencia: "R$/mês/posto",
      normalizado: true,
      possibilidade_adesao: "Sim",
      fornecedor: "Segurança 1000 (33.333.333/0001-33)",
    });
    const itemNormalizado2 = criarItemBase({
      descricao_objeto: "Posto Vigilância Diurna (Lote 3 postos)",
      valor_unitario: 9500,
      valor_original: 28500,
      unidade_original: "Lote 3 postos",
      formula_normalizacao: "R$ 28.500,00 ÷ 3 postos = R$ 9.500,00/mês/posto",
      unidade_referencia: "R$/mês/posto",
      normalizado: true,
      possibilidade_adesao: "Não informado",
      fornecedor: "Vigilância Top (44.444.444/0001-44)",
    });

    const bytes = await gerarPlanilhaXlsx(
      [itemNormalizado1, itemNormalizado2],
      [itemNormalizado1, itemNormalizado2],
      [0, 1],
      [],
      "menor_preco",
      "R$/mês/posto"
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);

    const ws1 = wb.getWorksheet("Planilha_Consolidada");
    assert.ok(ws1, "Aba Planilha_Consolidada deve existir");

    const headersAba1: string[] = [];
    ws1.eachRow((r, rowNum) => {
      if (rowNum === 1) {
        r.eachCell((cell) => {
          headersAba1.push(String(cell.value || ""));
        });
      }
    });

    // 1. Cabeçalhos esperados com padronização (9 colunas)
    assert.deepEqual(headersAba1, [
      "Descrição do objeto",
      "Valor Unitário Normalizado (R$/mês/posto)",
      "Memória de Cálculo (Lei 14.133/2021)",
      "Valor Homologado Original (R$)",
      "Nº da ARP / Licitação",
      "Possibilidade de Adesão",
      "Data de Assinatura",
      "Órgão Gerenciador/UF",
      "Fornecedor",
    ]);

    // Unidade Original ARP NÃO deve estar presente
    assert.ok(!headersAba1.includes("Unidade Original ARP"));

    // 2. Linhas de dados
    assert.equal(Number(ws1.getCell("B2").value), 10000);
    assert.equal(
      ws1.getCell("C2").value,
      "R$ 20.000,00 ÷ 2 postos = R$ 10.000,00/mês/posto"
    );
    assert.equal(Number(ws1.getCell("D2").value), 20000);
    assert.equal(ws1.getCell("F2").value, "Sim");
    assert.equal(ws1.getCell("I2").value, "Segurança 1000 (33.333.333/0001-33)");

    assert.equal(Number(ws1.getCell("B3").value), 9500);
    assert.equal(ws1.getCell("F3").value, "Não informado");
    assert.equal(ws1.getCell("I3").value, "Vigilância Top (44.444.444/0001-44)");

    // 3. Fórmulas de resumo na linha 4 apontando para Coluna B
    assert.equal(ws1.getCell("A4").value, "MÉDIA DOS VALORES UNITÁRIOS");
    assert.deepEqual(ws1.getCell("B4").value, { formula: "AVERAGE(B2:B3)" });

    assert.equal(ws1.getCell("A5").value, "MEDIANA DOS VALORES UNITÁRIOS");
    assert.deepEqual(ws1.getCell("B5").value, { formula: "MEDIAN(B2:B3)" });
  });

  it("Maior Desconto: cabeçalhos com Possibilidade de Adesão e fórmula da média na coluna B", async () => {
    const itemDesconto = criarItemBase({
      descricao_objeto: "Desconto em Combustível",
      valor_unitario: 6.5,
      possibilidade_adesao: "Sim",
      fornecedor: "Petro Distribuidora (55.555.555/0001-55)",
    });

    const bytes = await gerarPlanilhaXlsx(
      [itemDesconto],
      [itemDesconto],
      [0],
      [],
      "maior_desconto"
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);

    const ws1 = wb.getWorksheet("Planilha_Consolidada");
    assert.ok(ws1, "Aba Planilha_Consolidada deve existir");

    const headersAba1: string[] = [];
    ws1.eachRow((r, rowNum) => {
      if (rowNum === 1) {
        r.eachCell((cell) => {
          headersAba1.push(String(cell.value || ""));
        });
      }
    });

    assert.deepEqual(headersAba1, [
      "Descrição do objeto",
      "Taxa de Desconto (%)",
      "Nº da ARP / Licitação",
      "Possibilidade de Adesão",
      "Data de Assinatura",
      "Órgão Gerenciador/UF",
      "Fornecedor",
    ]);

    assert.equal(Number(ws1.getCell("B2").value), 6.5);
    assert.equal(ws1.getCell("D2").value, "Sim");
    assert.equal(ws1.getCell("G2").value, "Petro Distribuidora (55.555.555/0001-55)");

    assert.equal(ws1.getCell("A3").value, "MÉDIA DAS TAXAS DE DESCONTO");
    assert.deepEqual(ws1.getCell("B3").value, { formula: "AVERAGE(B2:B2)" });
  });
});
