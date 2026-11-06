import test from "node:test";
import assert from "node:assert";
import ExcelJS from "exceljs";
import { gerarPlanilhaXlsx } from "../../src/lib/export/exporter-xlsx.ts";
import { gerarCsvConsolidado } from "../../src/lib/export/exporter-csv.ts";
import { gerarRelatorioPdfA4 } from "../../src/lib/export/exporter-pdf.ts";
import type { ItemCandidato, ResultadoPesquisa } from "../../src/lib/domain/types.ts";

function criarItemMock(params: Partial<ItemCandidato>): ItemCandidato {
  return {
    descricao_objeto: "Locação de Veículo Hatch",
    valor_unitario: 2000,
    quantitativo_previsto_arp: "10 Veículo",
    quantidade_numerica_str: "10",
    unidade_fornecimento: "Veículo",
    numero_arp_licitacao: "ARP nº 10/2025",
    id_ata_r6: "12345678000199|ARP nº 10/2025",
    orgao_gerenciador_uf: "PREFEITURA DE GRAVATAÍ / RS",
    orgao_nome: "PREFEITURA DE GRAVATAÍ",
    uf: "RS",
    municipio_nome: "Gravataí",
    codigo_ibge: "4309209",
    fornecedor: "LOCADORA ALPHA LTDA (11.111.111/0001-11)",
    numero_item_lote: "1",
    data_assinatura: "10/01/2026",
    vigencia_ata: "10/01/2026 a 10/01/2027",
    data_fim_vigencia: "10/01/2027",
    situacao_ata: "Vigente",
    esfera: "Municipal",
    tipo_orgao: "Executivo",
    cnpj_orgao: "12345678000199",
    ano_compra: "2025",
    seq_compra: "1",
    seq_ata: "1",
    link_ata_pncp: "https://pncp.gov.br/app/atas/12345678000199/2025/1/1",
    aderencia: "A",
    detalhe_aderencia: "Aderência A",
    orgao_atende_validade: "Sim",
    data_hora_consulta: "03/11/2026 10:00:00",
    escopo_escolhido: "Todos",
    status_escolhido: "Vigentes",
    periodo_aplicado: "Vigência",
    termos_usados: "hatch",
    ...params,
  };
}

test("Exportadores devem identificar claramente Item/Lote e Fornecedor para múltiplos itens da mesma ARP", async () => {
  // Dois itens da mesma ARP com o mesmo preço, mas fornecedores e números de itens distintos
  const item1 = criarItemMock({
    numero_item_lote: "1",
    valor_unitario: 2200,
    quantitativo_previsto_arp: "5 Veículo",
    fornecedor: "FORNECEDOR A (11.111.111/0001-11)",
  });
  const item2 = criarItemMock({
    numero_item_lote: "2",
    valor_unitario: 2200,
    quantitativo_previsto_arp: "8 Veículo",
    fornecedor: "FORNECEDOR B (22.222.222/0001-22)",
  });

  const itens = [item1, item2];

  // 1. Teste CSV
  const csv = gerarCsvConsolidado(itens, "menor_preco");
  assert.ok(csv.includes("Quantitativo previsto na ARP"), "CSV deve conter cabeçalho de quantitativo");
  assert.ok(csv.includes("Nº do Item/Lote"), "CSV deve conter cabeçalho de Item/Lote");
  assert.ok(csv.includes("5 Veículo"), "CSV deve conter o quantitativo do Item 1");
  assert.ok(csv.includes("8 Veículo"), "CSV deve conter o quantitativo do Item 2");
  assert.ok(csv.includes("FORNECEDOR A"), "CSV deve conter o Fornecedor A");
  assert.ok(csv.includes("FORNECEDOR B"), "CSV deve conter o Fornecedor B");

  // 2. Teste XLSX
  const bytesXlsx = await gerarPlanilhaXlsx(itens, itens, [0, 1], []);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytesXlsx.buffer as ArrayBuffer);

  const ws1 = wb.getWorksheet("Planilha_Consolidada");
  assert.ok(ws1, "Aba Planilha_Consolidada deve existir");
  // Linha 2 e 3 devem identificar o item na ARP (Coluna C: Nº da ARP / Licitação em cesta sem padronização)
  const valC2: any = ws1.getCell("C2").value;
  const valC3: any = ws1.getCell("C3").value;
  const textArp1 = typeof valC2 === "object" && valC2 !== null ? valC2.text : String(valC2);
  const textArp2 = typeof valC3 === "object" && valC3 !== null ? valC3.text : String(valC3);
  assert.ok(textArp1.includes("Item 1"), "Aba 1 deve conter Item 1 na identificação da ARP");
  assert.ok(textArp2.includes("Item 2"), "Aba 1 deve conter Item 2 na identificação da ARP");

  const ws2 = wb.getWorksheet("Memoria_de_Pesquisa");
  assert.ok(ws2, "Aba Memoria_de_Pesquisa deve existir");
  assert.strictEqual(ws2.getCell("F2").value, "1", "Aba 2 deve ter número do item 1 na coluna F");
  assert.strictEqual(ws2.getCell("F3").value, "2", "Aba 2 deve ter número do item 2 na coluna F");

  // 3. Teste PDF
  const resMock: Partial<ResultadoPesquisa> = {
    momento_consulta: "03/11/2026 10:00:00",
    escopo_orgaos: "Todos",
    status_ata: "Vigentes",
    periodo_aplicado_str: "Vigência",
    termos_busca: ["hatch"],
    requisitos: [],
    total_atas_encontradas: 2,
    atas_validas_escopo_periodo: 2,
    total_itens_avaliados: 2,
    conferencias_status_api: [],
    itens_candidatos: itens,
    descartados: [],
    resumo_descartes: {},
  };
  const pdfBytes = await gerarRelatorioPdfA4(
    resMock as ResultadoPesquisa,
    itens,
    "Locação de Veículo Hatch",
    "menor_preco"
  );
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 500, "PDF deve ser gerado com tamanho válido");
});
