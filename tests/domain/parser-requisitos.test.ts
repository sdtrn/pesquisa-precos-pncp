import { describe, it, expect } from "vitest";
import {
  gerarTermosBusca,
  extrairRequisitosMinimos,
  avaliarAderenciaItem,
} from "@/lib/domain/parser-requisitos";

const DESC_LONA =
  "Rolo de lona em plástico medindo no mínimo 8MX100M. Rolo de lona - em plástico resistente, novo de primeiro uso, acondicionado em bobina, cor preto fosco medindo no mínimo 8mX100m com no mínimo 200 micras (0,200mm). Pesando no mínimo 110 kg.";

describe("Extração de Termos e Requisitos Mínimos e Classificação A/B/C", () => {
  it("gera termos de busca específicos para lona plástica preta sem palavras genéricas isoladas", () => {
    const termos = gerarTermosBusca(DESC_LONA);
    expect(termos).toEqual(["lona", "lona plastica", "lona preta"]);
  });

  it("gera termos compostos para locação de veículos nunca usando 'locacao' sozinho", () => {
    const termos = gerarTermosBusca(
      "Locação mensal de veículo tipo hatch, motorização mínima 1.0 flex, 4 portas, sem motorista"
    );
    expect(termos[0]).toBe("locacao de veiculo");
    expect(termos).not.toContain("locacao");
  });

  it("extrai os requisitos mínimos do caso clássico de lona 8x100m 200 micras 110kg", () => {
    const reqs = extrairRequisitosMinimos(DESC_LONA);
    const atributos = reqs.map((r) => r.Atributo);
    expect(atributos).toContain("Objeto principal");
    expect(atributos).toContain("Material");
    expect(atributos).toContain("Cor");
    expect(atributos).toContain("Largura");
    expect(atributos).toContain("Comprimento");
    expect(atributos).toContain("Espessura");
    expect(atributos).toContain("Peso");
    expect(atributos).toContain("Unidade de fornecimento");
  });

  it("classifica como A item completo, B item com peso ausente, e C item com dimensão menor ou unidade em metros (R5)", () => {
    const reqs = extrairRequisitosMinimos(DESC_LONA);

    const resA = avaliarAderenciaItem(
      "Lona plástica preta em polietileno 8x100m, espessura 200 micras, rolo com 115 kg",
      "ROLO",
      reqs
    );
    expect(resA.aderencia).toBe("A");

    const resB = avaliarAderenciaItem(
      "Bobina de lona plástica preta 8m x 100m, 0,20mm (200 micras)",
      "BOBINA",
      reqs
    );
    expect(resB.aderencia).toBe("B");
    expect(resB.ausentes.some((x) => x.includes("Peso"))).toBe(true);

    const resCUnidade = avaliarAderenciaItem(
      "Lona plástica preta 8x100m 200 micras 110kg",
      "METRO",
      reqs
    );
    expect(resCUnidade.aderencia).toBe("C");

    const resCDimensao = avaliarAderenciaItem(
      "Rolo de lona plástica preta 4x100m 200 micras 110kg",
      "ROLO",
      reqs
    );
    expect(resCDimensao.aderencia).toBe("C");
  });
});
