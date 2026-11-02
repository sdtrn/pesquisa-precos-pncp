import test from "node:test";
import assert from "node:assert";
import { parseTaxaDesconto } from "../../src/lib/domain/pdf-parser.ts";
import { formatValorOuTaxa, calcularEstatisticasPrecos } from "../../src/lib/domain/statistics.ts";
import { selecionarTop20Menores } from "../../src/lib/domain/pipeline.ts";
import type { ItemCandidato } from "../../src/lib/domain/types.ts";

test("End-to-End: Processamento de Ata com critério de Maior Desconto e fallback de 0%", () => {
  // Simulação do cenário real da ARP 261/2026 da Prefeitura do Recife
  const trechoAtaRecife =
    "1.2.4 Registro de Preços para gerenciamento de frota com taxa de desconto de 7,49% (sete inteiros e quarenta e nove centésimos por cento)";
  
  const taxaRecife = parseTaxaDesconto(trechoAtaRecife);
  assert.ok(taxaRecife);
  assert.strictEqual(taxaRecife.taxa, 7.49);

  // Simulação de Ata sem taxa identificável (deve assumir 0.00%)
  const trechoAtaSemTaxa = "Ata de Registro de Preços para serviços diversos com valor de R$ 50.000,00";
  const taxaSemDesconto = parseTaxaDesconto(trechoAtaSemTaxa);
  assert.strictEqual(taxaSemDesconto, null);
  const taxaFinalSemDesconto = taxaSemDesconto?.taxa ?? 0.0;
  assert.strictEqual(taxaFinalSemDesconto, 0.0);

  // Simulação de terceira Ata com desconto de 4.15%
  const trechoAtaOutra = "homologado com desconto linear de 4,15%";
  const taxaOutra = parseTaxaDesconto(trechoAtaOutra);
  assert.ok(taxaOutra);
  assert.strictEqual(taxaOutra.taxa, 4.15);

  const itensCandidatos: Partial<ItemCandidato>[] = [
    {
      cnpj_orgao: "41090291000133",
      orgao_nome: "PREFEITURA DA CIDADE DO RECIFE",
      numero_arp_licitacao: "ARP nº 261/2026",
      numero_item_lote: "1",
      valor_unitario: taxaRecife.taxa, // 7.49%
      aderencia: "A",
    },
    {
      cnpj_orgao: "11111111000111",
      orgao_nome: "PREFEITURA SEM DESCONTO DECLARADO",
      numero_arp_licitacao: "ARP nº 10/2026",
      numero_item_lote: "1",
      valor_unitario: taxaFinalSemDesconto, // 0.00%
      aderencia: "A",
    },
    {
      cnpj_orgao: "22222222000122",
      orgao_nome: "OUTRA PREFEITURA",
      numero_arp_licitacao: "ARP nº 55/2026",
      numero_item_lote: "1",
      valor_unitario: taxaOutra.taxa, // 4.15%
      aderencia: "A",
    },
  ];

  // 1. Ranking no critério maior_desconto deve colocar a Prefeitura do Recife no topo (7.49% > 4.15% > 0.00%)
  const ranking = selecionarTop20Menores(
    itensCandidatos as ItemCandidato[],
    false,
    20,
    "maior_desconto"
  );

  assert.strictEqual(ranking.length, 3);
  assert.strictEqual(ranking[0].orgao_nome, "PREFEITURA DA CIDADE DO RECIFE");
  assert.strictEqual(ranking[0].valor_unitario, 7.49);
  assert.strictEqual(ranking[1].valor_unitario, 4.15);
  assert.strictEqual(ranking[2].valor_unitario, 0.0);

  // 2. Formatação das taxas
  assert.strictEqual(formatValorOuTaxa(ranking[0].valor_unitario, "maior_desconto"), "7,49%");
  assert.strictEqual(formatValorOuTaxa(ranking[1].valor_unitario, "maior_desconto"), "4,15%");
  assert.strictEqual(formatValorOuTaxa(ranking[2].valor_unitario, "maior_desconto"), "0,00%");

  // 3. Estatísticas com taxas válidas (incluindo 0.00% como taxa válida)
  const stats = calcularEstatisticasPrecos(
    ranking.map((r) => r.valor_unitario),
    "maior_desconto"
  );
  assert.strictEqual(stats.quantidade, 3);
  assert.strictEqual(stats.maior, 7.49);
  assert.strictEqual(stats.menor, 0.0);
  // Média: (7.49 + 4.15 + 0.00) / 3 = 11.64 / 3 = 3.88
  assert.strictEqual(Math.round(stats.media * 100) / 100, 3.88);
});
