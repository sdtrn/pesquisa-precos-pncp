import test from "node:test";
import assert from "node:assert";
import { selecionarTop20Menores } from "../../src/lib/domain/pipeline.ts";
import {
  calcularEstatisticasPrecos,
  formatValorOuTaxa,
} from "../../src/lib/domain/statistics.ts";
import type { ItemCandidato } from "../../src/lib/domain/types.ts";

test("Task 3: Pipeline e estatísticas com suporte a maior taxa de desconto", () => {
  const candidatos: Partial<ItemCandidato>[] = [
    {
      cnpj_orgao: "111",
      numero_arp_licitacao: "ARP 1/2026",
      numero_item_lote: "1",
      valor_unitario: 3.2,
      aderencia: "A",
    },
    {
      cnpj_orgao: "222",
      numero_arp_licitacao: "ARP 2/2026",
      numero_item_lote: "1",
      valor_unitario: 8.5,
      aderencia: "A",
    },
    {
      cnpj_orgao: "333",
      numero_arp_licitacao: "ARP 3/2026",
      numero_item_lote: "1",
      valor_unitario: 5.0,
      aderencia: "A",
    },
    {
      // Mesma ARP 2, com taxa menor (5.2%) — no critério maior_desconto deve prevalecer a de 8.5%
      cnpj_orgao: "222",
      numero_arp_licitacao: "ARP 2/2026",
      numero_item_lote: "2",
      valor_unitario: 5.2,
      aderencia: "A",
    },
  ];

  // 1. Classificação por maior taxa de desconto: ordem decrescente (8.5 > 5.0 > 3.2)
  const topDesconto = selecionarTop20Menores(
    candidatos as ItemCandidato[],
    false,
    20,
    "maior_desconto"
  );
  assert.strictEqual(topDesconto.length, 3);
  assert.deepStrictEqual(
    topDesconto.map((x) => x.valor_unitario),
    [8.5, 5.0, 3.2]
  );
  assert.strictEqual(
    topDesconto[0].cnpj_orgao,
    "222",
    "A ARP 222 deve ser a primeira por ter o maior desconto (8.5%)"
  );

  // 2. Classificação padrão por menor preço: ordem crescente (3.2 < 5.0 < 5.2)
  const topPreco = selecionarTop20Menores(
    candidatos as ItemCandidato[],
    false,
    20,
    "menor_preco"
  );
  assert.strictEqual(topPreco.length, 3);
  assert.deepStrictEqual(
    topPreco.map((x) => x.valor_unitario),
    [3.2, 5.0, 5.2]
  );

  // 3. Formatação monetária vs percentual
  assert.strictEqual(formatValorOuTaxa(5.5, "maior_desconto"), "5,50%");
  assert.strictEqual(formatValorOuTaxa(5.5, "menor_preco"), "R$\u00A05,50");
  assert.strictEqual(formatValorOuTaxa(5.5), "R$\u00A05,50"); // default retrocompatível

  // 4. Estatísticas com taxas de desconto incluindo valores baixos
  const statsDesconto = calcularEstatisticasPrecos([0.5, 2.0, 3.5, 6.0], "maior_desconto");
  assert.strictEqual(statsDesconto.quantidade, 4);
  assert.strictEqual(statsDesconto.menor, 0.5);
  assert.strictEqual(statsDesconto.maior, 6.0);
  assert.strictEqual(statsDesconto.media, 3.0);
});
