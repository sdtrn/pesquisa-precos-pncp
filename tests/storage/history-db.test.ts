import { describe, it, expect } from "vitest";
import {
  deveSalvarAutomaticamenteNoHistorico,
  criarRegistroHistorico,
  exportarHistoricoJson,
  importarHistoricoJson,
} from "@/lib/storage/history-db";
import type { ItemCandidato, ResultadoPesquisa } from "@/lib/domain/types";

describe("Persistência do Histórico de Pesquisas e Controle de Gravação", () => {
  it("respeita a flag de salvar ou não no histórico", () => {
    expect(deveSalvarAutomaticamenteNoHistorico(true)).toBe(true);
    expect(deveSalvarAutomaticamenteNoHistorico(false)).toBe(false);
  });

  it("cria registro com data da pesquisa, calcula média e exporta/importa JSON com integridade", () => {
    const itens: Partial<ItemCandidato>[] = [
      { descricao_objeto: "Lona 8x100m", valor_unitario: 800 },
      { descricao_objeto: "Lona 8x100m", valor_unitario: 1000 },
    ];

    const resMock: Partial<ResultadoPesquisa> = {
      momento_consulta: "31/10/2026 19:30:00",
      escopo_orgaos: "Critério de validade",
      status_ata: "Vigentes",
      periodo_aplicado_str: "Data de assinatura da ata: sem início a sem fim",
      termos_busca: ["lona", "lona plastica"],
      requisitos: [],
      total_atas_encontradas: 40,
      atas_validas_escopo_periodo: 20,
      total_itens_avaliados: 120,
      conferencias_status_api: [],
      itens_candidatos: itens as ItemCandidato[],
      descartados: [],
      resumo_descartes: {},
    };

    const reg = criarRegistroHistorico(
      resMock as ResultadoPesquisa,
      "Rolo de lona 8x100m 200 micras",
      itens as ItemCandidato[],
      [0, 1],
      false
    );

    expect(reg.dataHoraPesquisa).toBe("31/10/2026 19:30:00");
    expect(reg.mediaSelecionados).toBe(900);
    expect(reg.itensSelecionadosCount).toBe(2);

    const json = exportarHistoricoJson([reg]);
    const importados = importarHistoricoJson(json);
    expect(importados).toHaveLength(1);
    expect(importados[0].id).toBe(reg.id);
    expect(importados[0].dataHoraPesquisa).toBe("31/10/2026 19:30:00");
  });
});
