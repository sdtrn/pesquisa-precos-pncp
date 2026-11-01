import { describe, it, expect } from "vitest";
import {
  gerarTermosBusca,
  extrairRequisitosMinimos,
  avaliarAderenciaItem,
  verificarCompatibilidadePreliminarAta,
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

  it("trata com precisão 'Aparelho de ar condicionado tipo split inverter, capacidade de 12000 BTU'", () => {
    const descAr =
      "Aparelho de ar condicionado tipo split inverter, capacidade de 12000 BTU";

    const termos = gerarTermosBusca(descAr);
    expect(termos).toEqual([
      "ar condicionado split",
      "split inverter",
      "condicionador de ar split",
      "ar condicionado inverter",
    ]);
    expect(gerarTermosBusca("Aparelho de ar condicionado")).toEqual([
      "ar condicionado",
      "condicionador de ar",
    ]);
    expect(termos).not.toContain("aparelho condicionado");

    const reqs = extrairRequisitosMinimos(descAr);
    expect(reqs.find((r) => r.Atributo === "Objeto principal")?.Valor).toBe(
      "ar condicionado"
    );
    expect(reqs.find((r) => r.Atributo === "Tipo / Categoria")?.Valor).toBe(
      "split"
    );
    expect(reqs.find((r) => r.Atributo === "Tecnologia")?.Valor).toBe(
      "inverter"
    );
    expect(reqs.find((r) => r.Atributo === "Potência")?.Valor).toBe("12000");
    expect(reqs.find((r) => r.Atributo === "Acessório")).toBeUndefined();

    // Item A com ponto separador de milhar (12.000 BTUs) e sem a palavra 'aparelho'
    const itemA1 = avaliarAderenciaItem(
      "AR CONDICIONADO SPLIT HI-WALL INVERTER, CAPACIDADE 12.000 BTUs, CICLO FRIO, 220V",
      "UNIDADE",
      reqs
    );
    expect(itemA1.aderencia).toBe("A");

    // Item A escrito como 'CONDICIONADOR DE AR' e '12.000 BTU/h'
    const itemA2 = avaliarAderenciaItem(
      "CONDICIONADOR DE AR TIPO SPLIT INVERTER 12.000 BTU/H FRIO",
      "UN",
      reqs
    );
    expect(itemA2.aderencia).toBe("A");

    // Item B quando omite 'inverter' (mas não diz convencional)
    const itemB = avaliarAderenciaItem(
      "AR CONDICIONADO TIPO SPLIT 12.000 BTUS CICLO FRIO",
      "UN",
      reqs
    );
    expect(itemB.aderencia).toBe("B");

    // Item C quando é convencional ou outra capacidade (18.000 BTUs / 9.000 BTUs) ou serviço de instalação/manutenção
    const itemCConv = avaliarAderenciaItem(
      "AR CONDICIONADO SPLIT CONVENCIONAL 12.000 BTUS",
      "UN",
      reqs
    );
    expect(itemCConv.aderencia).toBe("C");

    const itemC18k = avaliarAderenciaItem(
      "AR CONDICIONADO SPLIT INVERTER 18.000 BTUS",
      "UN",
      reqs
    );
    expect(itemC18k.aderencia).toBe("C");

    const itemCServico = avaliarAderenciaItem(
      "SERVIÇO DE INSTALAÇÃO E MANUTENÇÃO PREVENTIVA DE AR CONDICIONADO SPLIT INVERTER 12.000 BTUS",
      "SERVIÇO",
      reqs
    );
    expect(itemCServico.aderencia).toBe("C");

    const itemCSuporte = avaliarAderenciaItem(
      "Suporte Aparelho Ar Condicionado material: concreto armado pré-moldado",
      "UN",
      reqs
    );
    expect(itemCSuporte.aderencia).toBe("C");

    // Triagem preliminar de Atas
    expect(
      verificarCompatibilidadePreliminarAta(
        "Registro de preços para futura e eventual aquisição de aparelhos de ar condicionado",
        "Ata 01/2026",
        reqs
      ).compativel
    ).toBe(true);

    expect(
      verificarCompatibilidadePreliminarAta(
        "Contratação de empresa especializada em manutenção preventiva e corretiva de ar condicionado",
        "Ata 02/2026",
        reqs
      ).compativel
    ).toBe(false);

    expect(
      verificarCompatibilidadePreliminarAta(
        "Aquisição de suportes de concreto e peças de reposição para ar condicionado",
        "Ata 03/2026",
        reqs
      ).compativel
    ).toBe(false);

    expect(
      verificarCompatibilidadePreliminarAta(
        "Aquisição de aparelho de ultrassom odontológico e insumos hospitalares",
        "Ata 03/2026",
        reqs
      ).compativel
    ).toBe(false);
  });
});
