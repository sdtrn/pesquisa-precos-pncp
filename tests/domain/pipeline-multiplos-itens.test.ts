import test from "node:test";
import assert from "node:assert";
import { selecionarTop20Menores } from "../../src/lib/domain/selection.ts";
import type { ItemCandidato } from "../../src/lib/domain/types.ts";

function criarItemMock(params: Partial<ItemCandidato>): ItemCandidato {
  return {
    descricao_objeto: "Locação de Veículo Hatch",
    valor_unitario: 2000,
    quantitativo_previsto_arp: "10 Veículo",
    quantidade_numerica_str: "10",
    unidade_fornecimento: "Veículo",
    numero_arp_licitacao: "ARP nº 10/2025",
    id_ata_r6: "12345678000199|ARP nº 10/2025",
    orgao_gerenciador_uf: "PREFEITURA DE TESTE / PE",
    orgao_nome: "PREFEITURA DE TESTE",
    uf: "PE",
    municipio_nome: "Recife",
    codigo_ibge: "2611606",
    fornecedor: "FORNECEDOR ALPHA LTDA",
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

test("selecionarTop20Menores deve permitir múltiplos itens da mesma ARP no ranking Top 20", () => {
  // Dois itens da MESMA ARP (mesmo CNPJ e mesmo número de ARP), mas itens e fornecedores distintos
  const item1 = criarItemMock({
    numero_item_lote: "1",
    valor_unitario: 1800,
    fornecedor: "LOCADORA A LTDA",
  });
  const item2 = criarItemMock({
    numero_item_lote: "2",
    valor_unitario: 1950,
    fornecedor: "LOCADORA B LTDA",
  });
  const itemOutraAta = criarItemMock({
    cnpj_orgao: "99999999000199",
    numero_arp_licitacao: "ARP nº 99/2025",
    numero_item_lote: "1",
    valor_unitario: 2200,
    fornecedor: "LOCADORA C LTDA",
  });

  const candidatos = [itemOutraAta, item2, item1];
  const selecionados = selecionarTop20Menores(candidatos, false, 20, "menor_preco");

  // Ambos os itens da ARP 10/2025 devem estar presentes no Top 20
  assert.strictEqual(selecionados.length, 3, "Todos os 3 itens válidos devem ser retornados");
  assert.strictEqual(selecionados[0].numero_item_lote, "1");
  assert.strictEqual(selecionados[0].valor_unitario, 1800);
  assert.strictEqual(selecionados[1].numero_item_lote, "2");
  assert.strictEqual(selecionados[1].valor_unitario, 1950);
  assert.strictEqual(selecionados[2].valor_unitario, 2200);
});

test("selecionarTop20Menores com critério de maior desconto deve permitir múltiplos itens da mesma ARP", () => {
  const item1 = criarItemMock({
    numero_item_lote: "1",
    valor_unitario: 5.5, // 5.5% de desconto
    fornecedor: "POSTO A LTDA",
  });
  const item2 = criarItemMock({
    numero_item_lote: "2",
    valor_unitario: 7.2, // 7.2% de desconto
    fornecedor: "POSTO B LTDA",
  });

  const candidatos = [item1, item2];
  const selecionados = selecionarTop20Menores(candidatos, false, 20, "maior_desconto");

  assert.strictEqual(selecionados.length, 2);
  assert.strictEqual(selecionados[0].numero_item_lote, "2");
  assert.strictEqual(selecionados[0].valor_unitario, 7.2);
  assert.strictEqual(selecionados[1].numero_item_lote, "1");
  assert.strictEqual(selecionados[1].valor_unitario, 5.5);
});
