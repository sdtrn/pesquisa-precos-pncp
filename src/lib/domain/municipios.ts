import municipiosBilionariosRaw from "@/data/municipios-bilionarios.json";
import { ESCOPO_PE_RECIFE, ESCOPO_POR_ESTADO } from "@/data/constants";

export interface MunicipioBilionarioRow {
  uf: string;
  estado: string;
  municipio: string;
  perfil_localizacao: string;
  porte_orcamentario: string;
  fonte: string;
  codigo_ibge: string;
}

/**
 * Normaliza o nome do município removendo acentos, espaços extras e convertendo
 * para letras minúsculas, para casamento por igualdade EXATA (Regra R2).
 */
export function normalizarNomeMunicipio(nome?: string | null): string {
  if (!nome || typeof nome !== "string") {
    return "";
  }
  return nome
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarUf(uf?: string | null): string {
  if (!uf || typeof uf !== "string") {
    return "";
  }
  return uf.trim().toUpperCase();
}

// Índices em memória construídos uma única vez (O(1) lookup)
const CODIGOS_IBGE_VALIDOS = new Set<string>();
const CHAVES_NOME_UF_VALIDAS = new Set<string>();
const LISTA_MUNICIPIOS: MunicipioBilionarioRow[] = municipiosBilionariosRaw as MunicipioBilionarioRow[];

for (const row of LISTA_MUNICIPIOS) {
  const uf = normalizarUf(row.uf);
  const nomeNorm = normalizarNomeMunicipio(row.municipio);
  const codIbge = String(row.codigo_ibge || "").trim();

  if (codIbge) {
    CODIGOS_IBGE_VALIDOS.add(codIbge);
  }
  if (nomeNorm && uf) {
    CHAVES_NOME_UF_VALIDAS.add(`${nomeNorm}|${uf}`);
  }
}

export function obterListaMunicipiosBilionarios(): MunicipioBilionarioRow[] {
  return LISTA_MUNICIPIOS;
}

/**
 * Avalia se o órgão gerenciador atende ao Critério de Validade (Regras R1, R2 e R7).
 */
export function avaliarOrgaoGerenciador(
  esferaId?: string | null,
  uf?: string | null,
  municipioNome?: string | null,
  codigoIbge?: string | null
): {
  atendeCriterioValidade: boolean;
  motivoDescarteEscopoA: string | null;
  esferaNormalizada: string;
  metodoCasamentoMunicipio: string;
} {
  const esf = (esferaId || "").trim().toUpperCase();
  const ufNorm = normalizarUf(uf);
  const munNorm = normalizarNomeMunicipio(municipioNome);
  const codNorm = String(codigoIbge || "").trim();

  // Mapeamento estrito do campo canônico esfera_id / esferaId do PNCP:
  // "F" = Federal (União), "E" = Estadual, "D" = Distrital, "M" = Municipal
  if (!esf || !["F", "E", "D", "M"].includes(esf)) {
    return {
      atendeCriterioValidade: false,
      motivoDescarteEscopoA: "esfera não identificada",
      esferaNormalizada: "Não identificada",
      metodoCasamentoMunicipio: "Não aplicável (esfera não identificada)",
    };
  }

  if (esf === "F") {
    return {
      atendeCriterioValidade: true,
      motivoDescarteEscopoA: null,
      esferaNormalizada: "Federal",
      metodoCasamentoMunicipio: "União (Federal) - aceito por regra R1",
    };
  }

  if (esf === "E") {
    return {
      atendeCriterioValidade: true,
      motivoDescarteEscopoA: null,
      esferaNormalizada: "Estadual",
      metodoCasamentoMunicipio: "Estado - aceito por regra R1",
    };
  }

  if (esf === "D") {
    return {
      atendeCriterioValidade: true,
      motivoDescarteEscopoA: null,
      esferaNormalizada: "Distrital",
      metodoCasamentoMunicipio: "Distrito Federal - aceito por regra R1",
    };
  }

  // Esfera Municipal ("M"): aplicar Regra R1 e R2
  // R2: Casamento por código IBGE e/ou igualdade EXATA de (nome sem acentos e em minúsculas, UF).
  // Proibido casar por "contém"/substring.
  const casouIbge = Boolean(codNorm && CODIGOS_IBGE_VALIDOS.has(codNorm));
  const casouNomeUf = Boolean(
    munNorm && ufNorm && CHAVES_NOME_UF_VALIDAS.has(`${munNorm}|${ufNorm}`)
  );

  if (casouIbge && casouNomeUf) {
    return {
      atendeCriterioValidade: true,
      motivoDescarteEscopoA: null,
      esferaNormalizada: "Municipal",
      metodoCasamentoMunicipio: `Código IBGE (${codNorm}) e Nome+UF exatos (${municipioNome}/${ufNorm})`,
    };
  }
  if (casouIbge) {
    return {
      atendeCriterioValidade: true,
      motivoDescarteEscopoA: null,
      esferaNormalizada: "Municipal",
      metodoCasamentoMunicipio: `Código IBGE (${codNorm})`,
    };
  }
  if (casouNomeUf) {
    return {
      atendeCriterioValidade: true,
      motivoDescarteEscopoA: null,
      esferaNormalizada: "Municipal",
      metodoCasamentoMunicipio: `Igualdade exata Nome+UF (${municipioNome}/${ufNorm})`,
    };
  }

  return {
    atendeCriterioValidade: false,
    motivoDescarteEscopoA: "município fora da lista",
    esferaNormalizada: "Municipal",
    metodoCasamentoMunicipio: `Município não consta em municipios_bilionarios_2026.csv (${municipioNome || "sem nome"}/${ufNorm || "sem UF"})`,
  };
}

/**
 * Avalia os escopos especiais:
 *  - ESCOPO_POR_ESTADO: aceita apenas ARPs do Estado (E/D) e dos Municípios (M) pertencentes à UF escolhida.
 *  - ESCOPO_PE_RECIFE: aceita apenas ARPs originárias do Governo do Estado de Pernambuco (Poder Executivo)
 *    e da Prefeitura do Município do Recife (Poder Executivo), descartando Legislativo/Judiciário/TCE/MPPE.
 */
export function verificarEscopoEspecialOrgao(
  escopoOrgaos: string,
  ufSelecionada: string | null | undefined,
  esferaId: string,
  poderId: string,
  ufOrgao: string,
  municipioNome: string,
  codigoIbge: string,
  orgaoNome: string,
  unidadeNome: string
): { aprovado: boolean; motivo: string } {
  const esf = (esferaId || "").trim().toUpperCase();
  const pod = (poderId || "").trim().toUpperCase();
  const uf = (ufOrgao || "").trim().toUpperCase();
  const munNorm = normalizarNomeMunicipio(municipioNome);
  const ibge = (codigoIbge || "").trim();
  const orgNorm = normalizarNomeMunicipio(`${orgaoNome || ""} ${unidadeNome || ""}`);

  if (escopoOrgaos === ESCOPO_POR_ESTADO) {
    const ufAlvo = (ufSelecionada || "PE").trim().toUpperCase();
    if (!uf || uf !== ufAlvo) {
      return {
        aprovado: false,
        motivo: `órgão de outra UF (${uf || "não informada"} ≠ ${ufAlvo})`,
      };
    }
    if (!esf) {
      return { aprovado: false, motivo: "esfera não identificada" };
    }
    if (esf === "F") {
      return {
        aprovado: false,
        motivo: `órgão federal (escopo restrito ao Estado e municípios de ${ufAlvo})`,
      };
    }
    if (["E", "M", "D"].includes(esf)) {
      return {
        aprovado: true,
        motivo: `Órgão estadual/municipal da UF ${ufAlvo}`,
      };
    }
    return { aprovado: false, motivo: "esfera não identificada" };
  }

  if (escopoOrgaos === ESCOPO_PE_RECIFE) {
    if (uf !== "PE") {
      return {
        aprovado: false,
        motivo: `órgão fora de Pernambuco (UF=${uf || "não informada"}) — escopo restrito ao Governo de PE e Prefeitura do Recife`,
      };
    }
    if (!esf) {
      return { aprovado: false, motivo: "esfera não identificada" };
    }

    const termosNaoExecutivo = [
      "tribunal de justica",
      "tribunal de contas",
      "assembleia legislativa",
      "camara municipal",
      "ministerio publico",
      "defensoria publica",
    ];
    if (
      pod === "L" ||
      pod === "J" ||
      termosNaoExecutivo.some((t) => orgNorm.includes(t))
    ) {
      return {
        aprovado: false,
        motivo:
          "órgão do Legislativo/Judiciário/Controle Externo (escopo restrito ao Governo do Estado de PE e Prefeitura do Recife)",
      };
    }

    if (esf === "E") {
      return { aprovado: true, motivo: "Governo do Estado de Pernambuco" };
    }

    if (esf === "M") {
      const ehRecife = ibge === "2611606" || munNorm === "recife";
      if (ehRecife) {
        return { aprovado: true, motivo: "Prefeitura do Município do Recife" };
      }
      return {
        aprovado: false,
        motivo: `outro município de PE (${municipioNome || "não informado"} ≠ Recife) — escopo restrito ao Governo de PE e Prefeitura do Recife`,
      };
    }

    return {
      aprovado: false,
      motivo:
        "órgão federal (escopo restrito ao Governo do Estado de PE e Prefeitura do Recife)",
    };
  }

  return { aprovado: true, motivo: "Escopo padrão" };
}
