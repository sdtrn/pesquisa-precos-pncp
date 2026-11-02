import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PNCPClient } from "@/lib/domain/pncp-client.ts";
import { avaliarAderenciaItem, verificarCompatibilidadePreliminarAta } from "@/lib/domain/parser-requisitos.ts";

describe("Fallback Resiliente de Itens Sintéticos para ARPs Corporativas e Estaduais", () => {
  test("deve gerar item corporativo quando a API de itens v1 retornar vazio ou 503, mas a compra possui objeto homologado", async () => {
    const client = new PNCPClient(false);

    // Mock das chamadas privadas para simular falha em /itens e sucesso em obterDetalheCompra
    (client as unknown as Record<string, unknown>).getJson = async (url: string) => {
      if (url.includes("/itens")) {
        return null; // simula 503 ou 404 em /itens
      }
      if (url.includes("/compras/2024/527")) {
        return {
          numeroControlePNCP: "10572022000180-1-000527/2024",
          objetoCompra: "Formação de Registro de Preços Corporativo para contratação da prestação de serviços de motorista",
          valorTotalHomologado: 66720863.6,
          valorTotalEstimado: 80175553.85,
          processo: "1621.2024.AC-79.PE.0474.SAD",
          modalidadeNome: "Pregão - Eletrônico",
          linkSistemaOrigem: "http://www.peintegrado.pe.gov.br",
          existeResultado: true,
        };
      }
      return null;
    };

    const itens = await client.obterTodosItensCompra("10572022000180", "2024", "527");
    assert.strictEqual(itens.length, 1);
    assert.strictEqual(itens[0]._ehItemSinteticoAta, true);
    assert.strictEqual(itens[0].temResultado, true);
    assert.strictEqual(itens[0].numeroItem, 1);
    assert.ok(String(itens[0].descricao).includes("serviços de motorista"));

    const resultados = await client.obterResultadosItem("10572022000180", "2024", "527", "1");
    assert.strictEqual(resultados.length, 1);
    assert.strictEqual(resultados[0].valorUnitarioHomologado, 66720863.6);
    assert.ok(String(resultados[0].nomeRazaoSocialFornecedor).includes("1621.2024.AC-79.PE.0474.SAD"));
  });

  test("deve reprovar itens ou atas que sejam expressamente 'sem motorista' quando o objeto pesquisado requer motorista", () => {
    const requisitos = [
      {
        Atributo: "objeto",
        Operador: "contém",
        Valor: "motorista",
        Unidade: "",
        Obrigatorio: true,
      },
    ];

    // Item expressamente sem motorista
    const resSem = avaliarAderenciaItem(
      "Locação de veículos tipo van, sem motorista e sem combustível",
      "Veículo / Mês",
      requisitos,
      "",
      ""
    );
    assert.strictEqual(resSem.aderencia, "C");
    assert.ok(resSem.motivo.includes("sem motorista"));

    // Ata preliminar expressamente sem motorista
    const compatAtaSem = verificarCompatibilidadePreliminarAta(
      "Locação de veículos sem motorista para atender secretarias",
      "Ata de Registro de Preços",
      requisitos
    );
    assert.strictEqual(compatAtaSem.compativel, false);
    assert.ok(compatAtaSem.motivo.includes("sem motorista"));

    // Item e Ata com motorista
    const resCom = avaliarAderenciaItem(
      "Formação de Registro de Preços Corporativo para contratação da prestação de serviços de motorista",
      "Posto / Mês",
      requisitos,
      "",
      ""
    );
    assert.strictEqual(resCom.aderencia, "A");
  });
});
