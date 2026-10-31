import { describe, it, expect } from "vitest";
import {
  parseDataCalendarioRecife,
  formatarDataBr,
  verificarPeriodoLocal,
  verificarStatusLocal,
} from "@/lib/domain/tz-recife";
import {
  avaliarOrgaoGerenciador,
  verificarEscopoEspecialOrgao,
} from "@/lib/domain/municipios";
import {
  ESCOPO_PE_RECIFE,
  ESCOPO_POR_ESTADO,
  DATA_ASSINATURA,
  DATA_PUBLICACAO,
  DATA_VIGENCIA,
  STATUS_VIGENTES,
} from "@/data/constants";

describe("Fuso America/Recife e Datas", () => {
  it("mantém data pura YYYY-MM-DD sem deslocar fuso UTC", () => {
    expect(parseDataCalendarioRecife("2025-11-04")).toBe("2025-11-04");
    expect(formatarDataBr(parseDataCalendarioRecife("2025-11-04"))).toBe("04/11/2025");
  });

  it("interpreta ISO-8601 com nanosegundos e sufixo Z no fuso America/Recife", () => {
    expect(parseDataCalendarioRecife("2025-11-05T16:09:30.891311430")).toBe("2025-11-05");
    // 2025-11-05T01:30:00Z em UTC equivale a 2025-11-04 22:30:00 em America/Recife (UTC-3)
    expect(parseDataCalendarioRecife("2025-11-05T01:30:00Z")).toBe("2025-11-04");
  });

  it("verifica interseção de vigência, limites de período e data ausente (revisão B)", () => {
    const ok = verificarPeriodoLocal(
      DATA_VIGENCIA,
      "2026-01-01",
      "2026-06-30",
      "2025-10-01",
      null,
      "2025-10-01",
      "2026-10-01"
    );
    expect(ok.dentroDoPeriodo).toBe(true);

    const fora = verificarPeriodoLocal(
      DATA_ASSINATURA,
      "2026-03-23",
      "2026-10-21",
      "2026-01-15",
      null,
      null,
      null
    );
    expect(fora.dentroDoPeriodo).toBe(false);
    expect(fora.detalheMotivo).toBe("fora do período");

    const ausente = verificarPeriodoLocal(
      DATA_PUBLICACAO,
      "2026-01-01",
      "2026-10-21",
      "2026-05-01",
      null,
      null,
      null
    );
    expect(ausente.dentroDoPeriodo).toBe(true);
    expect(ausente.requerRevisaoBPorDataAusente).toBe(true);
  });

  it("identifica divergência local de status e ata cancelada (R4)", () => {
    const cancelada = verificarStatusLocal(STATUS_VIGENTES, "2026-01-01", "2027-01-01", true, "2026-06-01");
    expect(cancelada.divergencia).toBe(true);
    expect(cancelada.mensagem).toContain("CANCELADA");

    const vencida = verificarStatusLocal(STATUS_VIGENTES, "2024-01-01", "2025-01-01", false, "2026-06-01");
    expect(vencida.divergencia).toBe(true);
  });
});

describe("Validação de Municípios e Esferas (Regras R1, R2, R7)", () => {
  it("aprova Recife/PE (2611606) e Vitória/ES, mas reprova Vitória de Santo Antão/PE (sem substring)", () => {
    expect(avaliarOrgaoGerenciador("M", "PE", "Recife", "2611606").atendeCriterioValidade).toBe(true);
    expect(avaliarOrgaoGerenciador("M", "ES", "Vitória", "").atendeCriterioValidade).toBe(true);
    const vitoriaPe = avaliarOrgaoGerenciador("M", "PE", "Vitória de Santo Antão", "");
    expect(vitoriaPe.atendeCriterioValidade).toBe(false);
    expect(vitoriaPe.motivoDescarteEscopoA).toBe("município fora da lista");
  });

  it("aprova União (F), Estados (E) e DF (D) e reprova esfera vazia (R7)", () => {
    expect(avaliarOrgaoGerenciador("F", "DF", "Brasília", "").atendeCriterioValidade).toBe(true);
    expect(avaliarOrgaoGerenciador("E", "PE", "Recife", "").atendeCriterioValidade).toBe(true);
    expect(avaliarOrgaoGerenciador("D", "DF", "Brasília", "").atendeCriterioValidade).toBe(true);
    const semEsf = avaliarOrgaoGerenciador("", "PE", "Recife", "2611606");
    expect(semEsf.atendeCriterioValidade).toBe(false);
    expect(semEsf.motivoDescarteEscopoA).toBe("esfera não identificada");
  });

  it("valida escopos especiais (ARPs por Estado e Governo PE / Prefeitura do Recife)", () => {
    expect(
      verificarEscopoEspecialOrgao(ESCOPO_POR_ESTADO, "SP", "M", "E", "SP", "Campinas", "", "Prefeitura", "").aprovado
    ).toBe(true);
    expect(
      verificarEscopoEspecialOrgao(ESCOPO_POR_ESTADO, "SP", "F", "E", "SP", "São Paulo", "", "União", "").aprovado
    ).toBe(false);
    expect(
      verificarEscopoEspecialOrgao(ESCOPO_PE_RECIFE, null, "E", "E", "PE", "Recife", "2611606", "Secretaria de Administração", "").aprovado
    ).toBe(true);
    expect(
      verificarEscopoEspecialOrgao(ESCOPO_PE_RECIFE, null, "E", "J", "PE", "Recife", "2611606", "Tribunal de Justiça de PE", "").aprovado
    ).toBe(false);
  });
});
