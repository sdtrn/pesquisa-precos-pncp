import { describe, it, expect } from "vitest";
import {
  OPCOES_MODO_NORMALIZACAO,
  PRESETS_EXEMPLOS,
  MODO_NORMALIZACAO_AUTO,
  MODO_NORMALIZACAO_POSTO,
  MODO_NORMALIZACAO_VEICULO,
  MODO_NORMALIZACAO_DESATIVADO,
} from "@/data/constants";
import { detectarModoNormalizacaoSugerido } from "@/lib/domain/normalizador-precos";
import { criarRegistroHistorico } from "@/lib/storage/history-db";
import type { ItemCandidato, ResultadoPesquisa } from "@/lib/domain/types";

describe("Task 4: Interface e Parâmetros de Padronização de Preços Unitários", () => {
  it("deve conter as 4 opções completas de modo de normalização", () => {
    expect(OPCOES_MODO_NORMALIZACAO).toHaveLength(4);
    const ids = OPCOES_MODO_NORMALIZACAO.map((o) => o.id);
    expect(ids).toContain(MODO_NORMALIZACAO_AUTO);
    expect(ids).toContain(MODO_NORMALIZACAO_POSTO);
    expect(ids).toContain(MODO_NORMALIZACAO_VEICULO);
    expect(ids).toContain(MODO_NORMALIZACAO_DESATIVADO);
  });

  it("deve sugerir os modos adequados nos presets de exemplos rápidos", () => {
    const presetVeiculo = PRESETS_EXEMPLOS.find((p) => p.id === "locacao-veiculos-hatch");
    expect(presetVeiculo?.modoNormalizacaoSugerido).toBe(MODO_NORMALIZACAO_VEICULO);

    const presetVigilancia = PRESETS_EXEMPLOS.find((p) => p.id === "vigilancia-armada");
    expect(presetVigilancia?.modoNormalizacaoSugerido).toBe(MODO_NORMALIZACAO_POSTO);

    const presetAsg = PRESETS_EXEMPLOS.find((p) => p.id === "auxiliar-servicos-gerais");
    expect(presetAsg?.modoNormalizacaoSugerido).toBe(MODO_NORMALIZACAO_POSTO);

    const presetMotorista = PRESETS_EXEMPLOS.find((p) => p.id === "prestacao-servico-motorista");
    expect(presetMotorista?.modoNormalizacaoSugerido).toBe(MODO_NORMALIZACAO_POSTO);
  });

  it("deve detectar automaticamente o modo sugerido a partir das descrições dos presets", () => {
    expect(
      detectarModoNormalizacaoSugerido("Locação mensal de veículos tipo hatch")
    ).toBe(MODO_NORMALIZACAO_VEICULO);

    expect(
      detectarModoNormalizacaoSugerido("Serviço de vigilância armada")
    ).toBe(MODO_NORMALIZACAO_POSTO);

    expect(
      detectarModoNormalizacaoSugerido("Aquisição de ar condicionado split 12000 btu")
    ).toBe(MODO_NORMALIZACAO_DESATIVADO);
  });

  it("deve persistir o modo de normalização no registro de histórico", () => {
    const resMock: Partial<ResultadoPesquisa> = {
      momento_consulta: "02/11/2026 18:00:00",
      escopo_orgaos: "Todos os órgãos do Brasil",
      status_ata: "Vigentes",
      periodo_aplicado_str: "Sem filtro de data",
      termos_busca: ["vigilancia armada"],
      requisitos: [],
      total_atas_encontradas: 10,
      atas_validas_escopo_periodo: 5,
      total_itens_avaliados: 15,
      conferencias_status_api: [],
      itens_candidatos: [],
      descartados: [],
      resumo_descartes: {},
      modo_normalizacao_escolhido: MODO_NORMALIZACAO_POSTO,
      modo_normalizacao_aplicado: MODO_NORMALIZACAO_POSTO,
      unidade_referencia_padrao: "R$/mês/posto",
    };

    const reg = criarRegistroHistorico(
      resMock as ResultadoPesquisa,
      "Serviço de vigilância armada",
      [],
      [],
      false
    );

    expect(reg.modoNormalizacao).toBe(MODO_NORMALIZACAO_POSTO);
    expect(reg.resultado.unidade_referencia_padrao).toBe("R$/mês/posto");
  });
});
