import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TOP_N_ITENS_JANELA } from "../../src/data/constants.ts";
import { selecionarTop40Menores } from "../../src/lib/domain/selection.ts";
import type { ItemCandidato } from "../../src/lib/domain/types.ts";

function criarItemMock(idx: number, overrides: Partial<ItemCandidato> = {}): ItemCandidato {
  const cnpj = String(10000000000100 + idx);
  return {
    descricao_objeto: `Item de Teste ${idx}`,
    valor_unitario: idx * 10,
    quantitativo_previsto_arp: "10 Unidade",
    quantidade_numerica_str: "10",
    unidade_fornecimento: "UN",
    numero_arp_licitacao: `ARP nº ${idx}/2026`,
    id_ata_r6: `${cnpj}|ARP nº ${idx}/2026`,
    orgao_gerenciador_uf: `Órgão Teste ${idx}/PE`,
    orgao_nome: `Órgão Teste ${idx}`,
    uf: "PE",
    municipio_nome: "Recife",
    codigo_ibge: "2611606",
    fornecedor: `Fornecedor ${idx} Ltda`,
    numero_item_lote: "1",
    data_assinatura: "10/01/2026",
    vigencia_ata: "10/01/2026 a 10/01/2027",
    data_fim_vigencia: "10/01/2027",
    situacao_ata: "Vigente",
    esfera: "Municipal",
    tipo_orgao: "Executivo",
    cnpj_orgao: cnpj,
    ano_compra: "2026",
    seq_compra: String(idx),
    seq_ata: "1",
    link_ata_pncp: `https://pncp.gov.br/app/atas/${cnpj}/2026/${idx}/1`,
    aderencia: "A",
    detalhe_aderencia: "Aderência A",
    orgao_atende_validade: "Sim",
    data_hora_consulta: "18/11/2026 05:00:00",
    escopo_escolhido: "Todos os órgãos do Brasil",
    status_escolhido: "Vigentes",
    periodo_aplicado: "Vigência",
    termos_usados: "teste",
    ...overrides,
  };
}

describe("Expansão da Seleção de Preços para Top 40", () => {
  it("TOP_N_ITENS_JANELA deve estar configurado para 40 itens", () => {
    assert.equal(TOP_N_ITENS_JANELA, 40);
  });

  it("selecionarTop40Menores deve retornar os 40 menores preços unitários por padrão", () => {
    const candidatos = Array.from({ length: 55 }, (_, i) =>
      criarItemMock(55 - i, { valor_unitario: (55 - i) * 100 })
    );

    const selecionados = selecionarTop40Menores(candidatos);
    assert.equal(selecionados.length, 40);
    assert.equal(selecionados[0].valor_unitario, 100);
    assert.equal(selecionados[39].valor_unitario, 4000);
  });

  it("selecionarTop40Menores deve retornar as 40 maiores taxas de desconto no critério maior_desconto", () => {
    const candidatos = Array.from({ length: 55 }, (_, i) =>
      criarItemMock(i + 1, { valor_unitario: (i + 1) * 0.5 })
    );

    const selecionados = selecionarTop40Menores(
      candidatos,
      false,
      undefined,
      "maior_desconto"
    );
    assert.equal(selecionados.length, 40);
    assert.equal(selecionados[0].valor_unitario, 27.5);
    assert.equal(selecionados[39].valor_unitario, 8.0);
  });

  it("textos da interface devem referenciar os 40 menores preços e Top 40 em vez de 20", () => {
    const readSrc = (...parts: string[]) =>
      fs.readFileSync(path.resolve(process.cwd(), "src", ...parts), "utf-8");

    const modal = readSrc("components", "Top20SelectionModal.tsx");
    assert.match(modal, /Seleção Auditável das 40 Maiores Taxas de Desconto/);
    assert.match(modal, /Seleção Auditável dos 40 Menores Preços Unitários/);
    assert.match(modal, /lista dos 40 menores preços/);
    assert.doesNotMatch(modal, /20 Maiores|20 Menores|20 menores/i);

    const report = readSrc("components", "ConsolidatedReportPanel.tsx");
    assert.match(report, /Selecionar entre as 40 maiores taxas de desconto/);
    assert.match(report, /Selecionar entre os 40 menores preços/);
    assert.doesNotMatch(report, /20 maiores|20 menores/i);

    const form = readSrc("components", "SearchParametersForm.tsx");
    assert.match(form, /classificação das Atas no Top 40/);
    assert.doesNotMatch(form, /Top 20/);

    const historico = readSrc("app", "historico", "page.tsx");
    assert.match(historico, /Top 40:/);
    assert.match(historico, /Top 40 Válidos/);
    assert.match(historico, /Média Estimada Homologada \(Top 40\)/);
    assert.doesNotMatch(historico, /Top 20/);
  });
});
