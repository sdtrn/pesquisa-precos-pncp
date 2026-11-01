import test from "node:test";
import assert from "node:assert";
import {
  CRITERIO_MENOR_PRECO,
  CRITERIO_MAIOR_DESCONTO,
  PRESETS_EXEMPLOS,
} from "../../src/data/constants.ts";
import type { CriterioClassificacao } from "../../src/lib/domain/types.ts";

test("Task 1: Constantes de critério de classificação e preset de combustível", () => {
  // Validação dos valores das constantes
  assert.strictEqual(CRITERIO_MENOR_PRECO, "menor_preco");
  assert.strictEqual(CRITERIO_MAIOR_DESCONTO, "maior_desconto");

  // O tipo deve permitir ambos
  const c1: CriterioClassificacao = CRITERIO_MENOR_PRECO;
  const c2: CriterioClassificacao = CRITERIO_MAIOR_DESCONTO;
  assert.ok(c1 && c2);

  // Localiza o preset de frota e combustível
  const presetCombustivel = PRESETS_EXEMPLOS.find(
    (p) => p.id === "gestao-frota-combustivel"
  );
  assert.ok(presetCombustivel, "Preset 'gestao-frota-combustivel' deve existir em PRESETS_EXEMPLOS");
  assert.strictEqual(presetCombustivel.criterioSugerido, "maior_desconto");
  assert.match(presetCombustivel.titulo, /Gerenciamento de Frota/i);
  assert.match(presetCombustivel.descricao, /desconto/i);
});
