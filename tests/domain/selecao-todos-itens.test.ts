import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TOP_N_ITENS_JANELA } from "../../src/data/constants.ts";
import {
  selecionarTodosItensOrdenados,
  selecionarTop40Menores,
  selecionarTop20Menores,
} from "../../src/lib/domain/selection.ts";
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
    data_hora_consulta: "19/11/2026 07:55:00",
    escopo_escolhido: "Todos os órgãos do Brasil",
    status_escolhido: "Vigentes",
    periodo_aplicado: "Vigência",
    termos_usados: "teste",
    ...overrides,
  };
}

describe("Seleção sem limites de todos os preços encontrados", () => {
  it("TOP_N_ITENS_JANELA deve estar configurado sem limite finito", () => {
    assert.equal(TOP_N_ITENS_JANELA, Number.POSITIVE_INFINITY);
  });

  it("selecionarTodosItensOrdenados deve retornar todos os 120 preços unitários encontrados sem truncar em 20 ou 40", () => {
    const candidatos = Array.from({ length: 120 }, (_, i) =>
      criarItemMock(120 - i, { valor_unitario: (120 - i) * 100 })
    );

    const selecionados = selecionarTodosItensOrdenados(candidatos);
    assert.equal(selecionados.length, 120);
    assert.equal(selecionados[0].valor_unitario, 100);
    assert.equal(selecionados[119].valor_unitario, 12000);
  });

  it("selecionarTodosItensOrdenados deve retornar todas as 120 taxas de desconto ordenadas no critério maior_desconto", () => {
    const candidatos = Array.from({ length: 120 }, (_, i) =>
      criarItemMock(i + 1, { valor_unitario: (i + 1) * 0.25 })
    );

    const selecionados = selecionarTodosItensOrdenados(
      candidatos,
      false,
      undefined,
      "maior_desconto"
    );
    assert.equal(selecionados.length, 120);
    assert.equal(selecionados[0].valor_unitario, 30);
    assert.equal(selecionados[119].valor_unitario, 0.25);
  });

  it("deve manter respeito a limite explícito e compatibilidade dos aliases", () => {
    const candidatos = Array.from({ length: 65 }, (_, i) =>
      criarItemMock(i + 1, { valor_unitario: (i + 1) * 10 })
    );

    assert.equal(selecionarTop40Menores(candidatos).length, 65);
    assert.equal(selecionarTop20Menores(candidatos).length, 65);
    assert.equal(selecionarTodosItensOrdenados(candidatos, false, 15).length, 15);
  });

  it("textos da interface devem referenciar todos os preços encontrados sem mencionar 20 ou 40", () => {
    const readSrc = (...parts: string[]) =>
      fs.readFileSync(path.resolve(process.cwd(), "src", ...parts), "utf-8");

    const modal = readSrc("components", "Top20SelectionModal.tsx");
    assert.match(modal, /Seleção Auditável de Todas as Taxas de Desconto Encontradas/);
    assert.match(modal, /Seleção Auditável de Todos os Preços Unitários Encontrados/);
    assert.match(modal, /lista de todos os preços encontrados/);
    assert.match(modal, /lista de todas as taxas de desconto encontradas/);
    assert.doesNotMatch(modal, /\b(?:20|40)\s+(?:Maiores|Menores|menores|maiores)/);

    const report = readSrc("components", "ConsolidatedReportPanel.tsx");
    assert.match(report, /Selecionar entre todas as taxas de desconto/);
    assert.match(report, /Selecionar entre todos os preços encontrados/);
    assert.doesNotMatch(report, /\b(?:20|40)\s+(?:maiores|menores)/i);

    const form = readSrc("components", "SearchParametersForm.tsx");
    assert.match(form, /classificação de todas as Atas encontradas/);
    assert.doesNotMatch(form, /Top\s*(?:20|40)/i);

    const historico = readSrc("app", "historico", "page.tsx");
    assert.match(historico, /Válidos:/);
    assert.match(historico, /Itens Válidos/);
    assert.match(historico, /Média Estimada Homologada \(Todos os Válidos\)/);
    assert.doesNotMatch(historico, /Top\s*(?:20|40)/i);
  });
});
