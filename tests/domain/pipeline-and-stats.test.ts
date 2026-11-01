import { describe, it, expect } from "vitest";
import { selecionarTop20Menores, limparTextoExibicao, formatarQuantitativoArp } from "@/lib/domain/pipeline";
import { calcularEstatisticasPrecos, identificarOutliersIqr } from "@/lib/domain/statistics";
import { PNCPClient } from "@/lib/domain/pncp-client";
import type { ItemCandidato } from "@/lib/domain/types";

describe("Regra R6 (1 item por ata), Sanitização e Estatísticas", () => {
  it("normaliza termos de busca na API do PNCP preservando expressões compostas essenciais", () => {
    expect(PNCPClient.normalizarTermoParaApiSearch("ar condicionado")).toBe("ar condicionado");
    expect(PNCPClient.normalizarTermoParaApiSearch("ar condicionado split")).toBe("ar condicionado split");
    expect(PNCPClient.normalizarTermoParaApiSearch("split inverter")).toBe("split inverter");
    expect(PNCPClient.normalizarTermoParaApiSearch("ar condicionado split inverter")).toBe("split inverter");
    expect(PNCPClient.normalizarTermoParaApiSearch("lona plastica preta")).toBe("lona");
  });

  it("limpa tags HTML e caracteres de controle das descrições do PNCP", () => {
    expect(limparTextoExibicao("<p>Rolo de <strong>lona</strong>&nbsp;8x100m\x07</p>")).toBe(
      "Rolo de lona 8x100m"
    );
  });

  it("formata quantitativo previsto na ARP sem estimar valores ausentes", () => {
    expect(formatarQuantitativoArp(120, "ROLO")).toEqual(["120 ROLO", "120"]);
    expect(formatarQuantitativoArp(null, "ROLO")).toEqual(["não informado", "não informado"]);
  });

  it("aplica a Regra R6 mantendo no máximo 1 item por ata ordenado por menor valor unitário", () => {
    const candidatos: Partial<ItemCandidato>[] = [
      { cnpj_orgao: "111", numero_arp_licitacao: "ARP nº 1/2026", numero_item_lote: "1", valor_unitario: 950, aderencia: "A" },
      { cnpj_orgao: "111", numero_arp_licitacao: "ARP nº 1/2026", numero_item_lote: "2", valor_unitario: 890, aderencia: "A" },
      { cnpj_orgao: "222", numero_arp_licitacao: "ARP nº 2/2026", numero_item_lote: "1", valor_unitario: 750, aderencia: "B" },
      { cnpj_orgao: "333", numero_arp_licitacao: "ARP nº 3/2026", numero_item_lote: "1", valor_unitario: 910, aderencia: "A" },
    ];

    const topA = selecionarTop20Menores(candidatos as ItemCandidato[], false, 20);
    expect(topA).toHaveLength(2);
    expect(topA.map((x) => x.valor_unitario)).toEqual([890, 910]);

    const topAB = selecionarTop20Menores(candidatos as ItemCandidato[], true, 20);
    expect(topAB).toHaveLength(3);
    expect(topAB.map((x) => x.valor_unitario)).toEqual([750, 890, 910]);
  });

  it("calcula média, mediana, desvio-padrão, CV e identifica outliers IQR corretamente", () => {
    const valores = [100, 110, 105, 115, 108, 450];
    const stats = calcularEstatisticasPrecos(valores);
    expect(stats.quantidade).toBe(6);
    expect(stats.menor).toBe(100);
    expect(stats.maior).toBe(450);
    expect(stats.mediana).toBeCloseTo(109, 1);
    expect(stats.limiteSuperiorOutlier).toBeLessThan(450);

    const itensMock = valores.map((v, i) => ({
      cnpj_orgao: String(i),
      numero_arp_licitacao: `ARP ${i}`,
      numero_item_lote: "1",
      valor_unitario: v,
    })) as ItemCandidato[];

    const outliers = identificarOutliersIqr(itensMock);
    expect(outliers.has("5|ARP 5|1")).toBe(true);
    expect(outliers.has("0|ARP 0|1")).toBe(false);
  });
});
