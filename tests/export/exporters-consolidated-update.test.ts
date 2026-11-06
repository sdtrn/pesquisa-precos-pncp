import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gerarCsvConsolidado, HEADERS_CSV } from "../../src/lib/export/exporter-csv.ts";
import type { ItemCandidato } from "../../src/lib/domain/types.ts";

function criarItemCandidatoMock(overrides: Partial<ItemCandidato> = {}): ItemCandidato {
  return {
    item_url: "https://pncp.gov.br/app/atas/11222333000181/2026/1/1",
    link_ata_pncp: "https://pncp.gov.br/app/atas/11222333000181/2026/1/1",
    link_download_arp: "https://pncp.gov.br/api/pncp/v1/orgaos/11222333000181/compras/2026/1/arquivos/1",
    numero_controle_pncp: "11222333000181-1-000001/2026-000001",
    numero_arp_licitacao: "ARP 01/2026 (PE 10/2026)",
    orgao_gerenciador_uf: "Prefeitura Municipal do Recife/PE",
    esfera: "Municipal",
    tipo_orgao: "Administração Direta",
    cnpj_orgao: "11222333000181",
    fornecedor: "Empresa XPTO Ltda (00.111.222/0001-33)",
    valor_unitario: 1500,
    descricao_objeto: "Computador Desktop Core i5 16GB SSD 512GB",
    data_assinatura: "15/01/2026",
    vigencia_ata: "12 meses",
    data_fim_vigencia: "15/01/2027",
    situacao_ata: "Vigente",
    aderencia: "Alta",
    detalhe_aderencia: "Correspondência exata",
    orgao_atende_validade: "Sim",
    quantitativo_previsto_arp: "100",
    unidade_fornecimento: "Unidade",
    numero_item_lote: "1",
    data_hora_consulta: "06/11/2026 10:00:00",
    escopo_escolhido: "Brasil (todos os órgãos)",
    status_escolhido: "Vigente",
    periodo_aplicado: "Último ano",
    termos_usados: "computador desktop",
    possibilidade_adesao: "Sim",
    ...overrides,
  };
}

describe("Exportador CSV Consolidado — Coluna Possibilidade de Adesão e Fornecedor com CNPJ", () => {
  it("exporta cabeçalho contendo 'Possibilidade de Adesão' posicionado após 'Nº da ARP / Licitação'", () => {
    const csv = gerarCsvConsolidado([]);
    const linhas = csv.split("\r\n");
    const cabecalhoLinha = linhas[0].replace(/^\uFEFF/, "");
    const colunas = cabecalhoLinha.split(";");

    assert.ok(
      colunas.includes("Possibilidade de Adesão"),
      `Coluna 'Possibilidade de Adesão' ausente nos cabeçalhos: ${colunas.join(", ")}`
    );

    const idxArp = colunas.indexOf("Nº da ARP / Licitação");
    const idxAdesao = colunas.indexOf("Possibilidade de Adesão");
    const idxData = colunas.indexOf("Data de Assinatura");

    assert.ok(idxArp >= 0, "Coluna 'Nº da ARP / Licitação' deve existir");
    assert.equal(
      idxAdesao,
      idxArp + 1,
      "'Possibilidade de Adesão' deve vir imediatamente após 'Nº da ARP / Licitação'"
    );
    assert.equal(
      idxData,
      idxAdesao + 1,
      "'Data de Assinatura' deve vir imediatamente após 'Possibilidade de Adesão'"
    );

    assert.ok(Array.isArray(HEADERS_CSV), "HEADERS_CSV deve ser exportado");
    assert.ok(HEADERS_CSV.includes("Possibilidade de Adesão"));
  });

  it("exporta os valores 'Sim', 'Não' e 'Não informado' para possibilidade_adesao e fornecedor com CNPJ pontuado", () => {
    const itemSim = criarItemCandidatoMock({
      numero_arp_licitacao: "ARP 01/2026",
      possibilidade_adesao: "Sim",
      fornecedor: "Tech Distribuidora Ltda (11.222.333/0001-44)",
      valor_unitario: 1000,
    });

    const itemNao = criarItemCandidatoMock({
      numero_arp_licitacao: "ARP 02/2026",
      possibilidade_adesao: "Não",
      fornecedor: "Mega Soluções S.A. (55.666.777/0001-88)",
      valor_unitario: 2000,
    });

    const itemNaoInformado = criarItemCandidatoMock({
      numero_arp_licitacao: "ARP 03/2026",
      possibilidade_adesao: undefined,
      fornecedor: "Comércio Alpha ME (99.888.777/0001-66)",
      valor_unitario: 3000,
    });

    const csv = gerarCsvConsolidado([itemSim, itemNao, itemNaoInformado], "menor_preco");
    const linhas = csv.split("\r\n");
    const cabecalhoLinha = linhas[0].replace(/^\uFEFF/, "");
    const colunas = cabecalhoLinha.split(";");
    const idxAdesao = colunas.indexOf("Possibilidade de Adesão");
    const idxForn = colunas.indexOf("Fornecedor");

    assert.ok(idxAdesao >= 0, "Índice de Adesão deve ser válido");
    assert.ok(idxForn >= 0, "Índice de Fornecedor deve ser válido");

    // Linha 1: itemSim
    const cols1 = linhas[1].split(";");
    assert.equal(cols1.length, colunas.length, "Linha 1 deve ter a mesma quantidade de colunas do cabeçalho");
    assert.equal(cols1[idxAdesao], "Sim");
    assert.equal(cols1[idxForn], "Tech Distribuidora Ltda (11.222.333/0001-44)");

    // Linha 2: itemNao
    const cols2 = linhas[2].split(";");
    assert.equal(cols2.length, colunas.length, "Linha 2 deve ter a mesma quantidade de colunas do cabeçalho");
    assert.equal(cols2[idxAdesao], "Não");
    assert.equal(cols2[idxForn], "Mega Soluções S.A. (55.666.777/0001-88)");

    // Linha 3: itemNaoInformado -> fallback para "Não informado"
    const cols3 = linhas[3].split(";");
    assert.equal(cols3.length, colunas.length, "Linha 3 deve ter a mesma quantidade de colunas do cabeçalho");
    assert.equal(cols3[idxAdesao], "Não informado");
    assert.equal(cols3[idxForn], "Comércio Alpha ME (99.888.777/0001-66)");
  });

  it("linha final de média inclui '—' na coluna de Adesão e alinha perfeitamente com os cabeçalhos", () => {
    const item1 = criarItemCandidatoMock({
      valor_unitario: 1000,
      possibilidade_adesao: "Sim",
    });
    const item2 = criarItemCandidatoMock({
      valor_unitario: 3000,
      possibilidade_adesao: "Não",
    });

    const csv = gerarCsvConsolidado([item1, item2], "menor_preco");
    const linhas = csv.split("\r\n");
    const cabecalhoLinha = linhas[0].replace(/^\uFEFF/, "");
    const colunas = cabecalhoLinha.split(";");
    const idxAdesao = colunas.indexOf("Possibilidade de Adesão");

    // Linha 3 é a média (Linha 0: cabeçalho, 1: item1, 2: item2, 3: média)
    const linhaMedia = linhas[3];
    assert.ok(linhaMedia.startsWith("MÉDIA DOS VALORES UNITÁRIOS"), "Linha deve iniciar com título da média");

    const colsMedia = linhaMedia.split(";");
    assert.equal(
      colsMedia.length,
      colunas.length,
      `Linha de média (${colsMedia.length} cols) deve ter o mesmo número de colunas do cabeçalho (${colunas.length} cols)`
    );
    assert.equal(
      colsMedia[idxAdesao],
      "—",
      "Coluna 'Possibilidade de Adesão' na linha de média deve conter travessão '—'"
    );
  });

  it("funciona corretamente no critério maior_desconto com Taxa de Desconto (%) e Adesão", () => {
    const itemDesc = criarItemCandidatoMock({
      valor_unitario: 12.5,
      possibilidade_adesao: "Sim",
    });

    const csv = gerarCsvConsolidado([itemDesc], "maior_desconto");
    const linhas = csv.split("\r\n");
    const colunas = linhas[0].replace(/^\uFEFF/, "").split(";");

    assert.ok(colunas.includes("Taxa de Desconto (%)"));
    assert.ok(colunas.includes("Possibilidade de Adesão"));

    const idxAdesao = colunas.indexOf("Possibilidade de Adesão");
    const colsItem = linhas[1].split(";");
    assert.equal(colsItem[idxAdesao], "Sim");

    const colsMedia = linhas[2].split(";");
    assert.ok(colsMedia[0].includes("MÉDIA DAS TAXAS DE DESCONTO"));
    assert.equal(colsMedia[idxAdesao], "—");
    assert.equal(colsMedia.length, colunas.length);
  });
});
