import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PNCPClient } from "@/lib/domain/pncp-client.ts";
import { avaliarAderenciaItem, verificarCompatibilidadePreliminarAta } from "@/lib/domain/parser-requisitos.ts";

describe("Resiliência de Itens e Filtro de Motorista em ARPs", () => {
  test("não deve inventar item corporativo sintético quando a API de itens v1 retornar vazio ou 503", async () => {
    const client = new PNCPClient(false);

    // Mock das chamadas privadas para simular falha em /itens
    (client as unknown as Record<string, unknown>).getJson = async (url: string) => {
      if (url.includes("/itens")) {
        return null; // simula 503 ou 404 em /itens
      }
      return null;
    };

    const itens = await client.obterTodosItensCompra("10572022000180", "2024", "527");
    assert.strictEqual(itens.length, 0);
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
