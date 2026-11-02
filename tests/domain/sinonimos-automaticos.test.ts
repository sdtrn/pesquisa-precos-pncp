import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  gerarTermosBusca,
  avaliarAderenciaItem,
  GRUPOS_SINONIMOS_AUTOMATICOS,
} from "@/lib/domain/parser-requisitos.ts";
import { DATA_VIGENCIA } from "@/data/constants.ts";

describe("Sinônimos Automáticos Ativados para Compras Públicas", () => {
  test("deve possuir catálogo estruturado com os grupos mais procurados", () => {
    const ids = GRUPOS_SINONIMOS_AUTOMATICOS.map((g) => g.id);
    assert.ok(ids.includes("motorista"));
    assert.ok(ids.includes("vigilancia"));
    assert.ok(ids.includes("limpeza"));
    assert.ok(ids.includes("combustivel"));
    assert.ok(ids.includes("alimentacao"));
    assert.ok(ids.includes("papel_a4"));
    assert.ok(ids.includes("impressao"));
    assert.ok(ids.includes("mobiliario"));
    assert.ok(ids.includes("computador"));
    assert.ok(ids.includes("medicamentos"));
  });

  test("deve expandir termos de busca automaticamente para motorista e condutor", () => {
    const termos = gerarTermosBusca("prestação de serviços de MOTORISTA");
    assert.ok(termos.includes("motorista"));
    assert.ok(termos.includes("condutor"));
  });

  test("deve expandir termos de busca para vigilância, limpeza, combustível e papel a4", () => {
    const termosVig = gerarTermosBusca("Serviço continuado de vigilância armada");
    assert.ok(termosVig.includes("vigilancia"));
    assert.ok(termosVig.includes("vigilante") || termosVig.includes("seguranca patrimonial"));

    const termosLimp = gerarTermosBusca("Contratação de serviços de limpeza e conservação predial");
    assert.ok(termosLimp.includes("limpeza"));
    assert.ok(termosLimp.includes("conservacao predial") || termosLimp.includes("asseio e conservacao"));

    const termosComb = gerarTermosBusca("Fornecimento de combustível para a frota");
    assert.ok(termosComb.includes("combustivel"));
    assert.ok(termosComb.includes("gasolina") || termosComb.includes("oleo diesel"));

    const termosPapel = gerarTermosBusca("Resma de papel A4 sulfite");
    assert.ok(termosPapel.includes("papel a4") || termosPapel.includes("papel sulfite") || termosPapel.includes("resma"));
  });

  test("deve reconhecer sinônimos bidirecionais na avaliação de aderência de itens", () => {
    // 1. Motorista <-> Condutor
    const reqMotorista = [
      { Atributo: "objeto", Operador: "contém", Valor: "motorista", Unidade: "", Obrigatorio: true },
    ];
    const resCondutor = avaliarAderenciaItem(
      "Contratação de condutores de veículos oficiais para atendimento de secretarias",
      "Posto / Mês",
      reqMotorista,
      "",
      ""
    );
    assert.strictEqual(resCondutor.aderencia, "A");

    // 2. Vigilância <-> Segurança Patrimonial / Porteiro
    const reqVig = [
      { Atributo: "objeto", Operador: "contém", Valor: "vigilancia", Unidade: "", Obrigatorio: true },
    ];
    const resSeg = avaliarAderenciaItem(
      "Prestação de serviços continuados de segurança patrimonial desarmada",
      "Posto / Mês",
      reqVig,
      "",
      ""
    );
    assert.strictEqual(resSeg.aderencia, "A");

    // 3. Limpeza <-> Asseio e Conservação
    const reqLimp = [
      { Atributo: "objeto", Operador: "contém", Valor: "limpeza", Unidade: "", Obrigatorio: true },
    ];
    const resAsseio = avaliarAderenciaItem(
      "Serviços de asseio e conservação de instalações prediais",
      "Posto / Mês",
      reqLimp,
      "",
      ""
    );
    assert.strictEqual(resAsseio.aderencia, "A");
  });

  test("constante padrão de vigência deve estar definida corretamente", () => {
    assert.strictEqual(DATA_VIGENCIA, "Vigência");
  });
});
